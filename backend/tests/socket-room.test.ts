import "dotenv/config";

import { createServer, type Server as HttpServer } from "node:http";
import { randomBytes } from "node:crypto";

import { io, type Socket } from "socket.io-client";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import app from "../src/app.js";
import { getPrismaClient } from "../src/config/database.js";
import { createSocketServer } from "../src/socket/index.js";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required to run Socket.IO integration tests.");
}

const prisma = getPrismaClient();
const sockets = new Set<Socket>();
let httpServer: HttpServer;
let baseUrl: string;
let createdUserIds: string[] = [];
let createdRoomIds: string[] = [];

function roomCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from(randomBytes(6), (byte) => alphabet[byte % alphabet.length]).join("");
}

function waitForEvent<T>(socket: Socket, event: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(`Timed out waiting for ${event}.`)), 2_000);
    socket.once(event, (payload: T) => {
      clearTimeout(timeout);
      resolve(payload);
    });
  });
}

async function connectSocket(): Promise<Socket> {
  const socket = io(baseUrl, { forceNew: true, transports: ["websocket"] });
  sockets.add(socket);
  await waitForEvent<void>(socket, "connect");
  return socket;
}

async function createRoomWithMembers(memberNames: string[]) {
  const users = await Promise.all(memberNames.map((name) => prisma.user.create({ data: { name } })));
  createdUserIds.push(...users.map((user) => user.id));

  const room = await prisma.room.create({ data: { code: roomCode(), ownerId: users[0].id } });
  createdRoomIds.push(room.id);
  await prisma.roomMember.createMany({
    data: users.map((user) => ({ roomId: room.id, userId: user.id, status: "ACTIVE", isConnected: false }))
  });

  return { room, users };
}

function joinRealtime(socket: Socket, roomId: string, userId: string) {
  const state = waitForEvent<{ room: { id: string }; participants: Array<{ userId: string }> }>(socket, "room_state");
  socket.emit("room:join", { roomId, userId });
  return state;
}

beforeAll(async () => {
  httpServer = createServer(app);
  createSocketServer(httpServer);
  await new Promise<void>((resolve) => httpServer.listen(0, "127.0.0.1", resolve));
  const address = httpServer.address();
  if (!address || typeof address === "string") {
    throw new Error("Unable to determine test server address.");
  }
  baseUrl = `http://127.0.0.1:${address.port}`;
});

afterEach(async () => {
  for (const socket of sockets) {
    socket.disconnect();
  }
  sockets.clear();

  if (createdRoomIds.length > 0) {
    await prisma.roomMember.deleteMany({ where: { roomId: { in: createdRoomIds } } });
    await prisma.room.deleteMany({ where: { id: { in: createdRoomIds } } });
  }
  if (createdUserIds.length > 0) {
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
  }
  createdRoomIds = [];
  createdUserIds = [];
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) => httpServer.close((error) => (error ? reject(error) : resolve())));
  await prisma.$disconnect();
});

describe("Phase 4 Socket.IO room presence", () => {
  it("connects an active member, sends room_state, and sets presence", async () => {
    const { room, users } = await createRoomWithMembers(["Owner"]);
    const socket = await connectSocket();

    const state = await joinRealtime(socket, room.id, users[0].id);
    expect(state.room.id).toBe(room.id);
    expect(state.participants).toEqual([
      expect.objectContaining({ userId: users[0].id, name: "Owner", status: "ACTIVE" })
    ]);
    expect(
      await prisma.roomMember.findUnique({ where: { roomId_userId: { roomId: room.id, userId: users[0].id } } })
    ).toMatchObject({ status: "ACTIVE", isConnected: true });
  });

  it("rejects a non-member with a structured socket error", async () => {
    const { room, users } = await createRoomWithMembers(["Owner"]);
    const outsider = await prisma.user.create({ data: { name: "Outsider" } });
    createdUserIds.push(outsider.id);
    const socket = await connectSocket();

    const error = waitForEvent<{ code: string; message: string }>(socket, "socket:error");
    socket.emit("room:join", { roomId: room.id, userId: outsider.id });
    await expect(error).resolves.toMatchObject({ code: "NOT_A_ROOM_MEMBER", message: expect.any(String) });
    expect(users[0].id).toEqual(expect.any(String));
  });

  it("returns authoritative state on an explicit room:state request", async () => {
    const { room, users } = await createRoomWithMembers(["Owner", "Member"]);
    const socket = await connectSocket();
    await joinRealtime(socket, room.id, users[0].id);

    const state = waitForEvent<{ room: { id: string }; participants: Array<{ userId: string }> }>(socket, "room_state");
    socket.emit("room:state", { roomId: room.id });
    await expect(state).resolves.toMatchObject({
      room: { id: room.id },
      participants: expect.arrayContaining([
        expect.objectContaining({ userId: users[0].id }),
        expect.objectContaining({ userId: users[1].id })
      ])
    });
  });

  it("broadcasts one user_joined event for repeated room:join calls", async () => {
    const { room, users } = await createRoomWithMembers(["Owner", "Member"]);
    const ownerSocket = await connectSocket();
    await joinRealtime(ownerSocket, room.id, users[0].id);
    const memberSocket = await connectSocket();

    const joined = waitForEvent<{ userId: string; roomId: string; name: string }>(ownerSocket, "user_joined");
    await joinRealtime(memberSocket, room.id, users[1].id);
    await expect(joined).resolves.toMatchObject({ userId: users[1].id, roomId: room.id, name: "Member" });

    let joinedCount = 0;
    ownerSocket.on("user_joined", () => {
      joinedCount += 1;
    });
    await joinRealtime(memberSocket, room.id, users[1].id);
    expect(joinedCount).toBe(0);
  });

  it("emits user_left on disconnect without changing ACTIVE membership", async () => {
    const { room, users } = await createRoomWithMembers(["Owner", "Member"]);
    const ownerSocket = await connectSocket();
    await joinRealtime(ownerSocket, room.id, users[0].id);
    const memberSocket = await connectSocket();
    await joinRealtime(memberSocket, room.id, users[1].id);

    const left = waitForEvent<{ userId: string; roomId: string }>(ownerSocket, "user_left");
    memberSocket.disconnect();
    await expect(left).resolves.toMatchObject({ userId: users[1].id, roomId: room.id });
    expect(
      await prisma.roomMember.findUnique({ where: { roomId_userId: { roomId: room.id, userId: users[1].id } } })
    ).toMatchObject({ status: "ACTIVE", isConnected: false });
  });

  it("reconnects with room:join and waits for the final socket before user_left", async () => {
    const { room, users } = await createRoomWithMembers(["Owner", "Member"]);
    const ownerSocket = await connectSocket();
    await joinRealtime(ownerSocket, room.id, users[0].id);
    const firstMemberSocket = await connectSocket();
    const secondMemberSocket = await connectSocket();
    await joinRealtime(firstMemberSocket, room.id, users[1].id);
    await joinRealtime(secondMemberSocket, room.id, users[1].id);

    let leftCount = 0;
    ownerSocket.on("user_left", () => {
      leftCount += 1;
    });
    firstMemberSocket.disconnect();
    const recoveredState = await joinRealtime(secondMemberSocket, room.id, users[1].id);
    expect(recoveredState.room.id).toBe(room.id);
    expect(leftCount).toBe(0);

    const left = waitForEvent<{ userId: string }>(ownerSocket, "user_left");
    secondMemberSocket.disconnect();
    await expect(left).resolves.toMatchObject({ userId: users[1].id });

    const reconnectedSocket = await connectSocket();
    const stateAfterReconnect = await joinRealtime(reconnectedSocket, room.id, users[1].id);
    expect(stateAfterReconnect.room.id).toBe(room.id);
  });

  it("returns VALIDATION_ERROR for malformed socket payloads", async () => {
    const socket = await connectSocket();

    const error = waitForEvent<{ code: string; details: unknown[] }>(socket, "socket:error");
    socket.emit("room:join", { roomId: "" });
    await expect(error).resolves.toMatchObject({ code: "VALIDATION_ERROR", details: expect.any(Array) });
  });
});
