import "dotenv/config";

import { randomBytes } from "node:crypto";
import { createServer, type Server as HttpServer } from "node:http";

import request from "supertest";
import { io, type Socket } from "socket.io-client";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import app from "../src/app.js";
import { getPrismaClient } from "../src/config/database.js";
import { clearSpinTimersForTests, getLatestSpin, processSpinElimination, startSpin } from "../src/services/spin.service.js";
import { leaveRoom } from "../src/services/room.service.js";
import { createSocketServer } from "../src/socket/index.js";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required to run spin integration tests.");
}

const prisma = getPrismaClient();
const sockets = new Set<Socket>();
let httpServer: HttpServer;
let baseUrl: string;
let createdUserIds: string[] = [];
let createdRoomIds: string[] = [];

function createRoomCode() {
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

async function createRoomWithMembers(memberCount: number) {
  const users = await Promise.all(
    Array.from({ length: memberCount }, (_, index) => prisma.user.create({ data: { name: `Spin User ${index + 1}` } }))
  );
  createdUserIds.push(...users.map((user) => user.id));
  const room = await prisma.room.create({ data: { code: createRoomCode(), ownerId: users[0].id } });
  createdRoomIds.push(room.id);
  await prisma.roomMember.createMany({
    data: users.map((user) => ({ roomId: room.id, userId: user.id, status: "ACTIVE", isConnected: false }))
  });
  return { room, users };
}

async function connectSocket() {
  const socket = io(baseUrl, { forceNew: true, transports: ["websocket"] });
  sockets.add(socket);
  await waitForEvent<void>(socket, "connect");
  return socket;
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
  clearSpinTimersForTests();
  vi.useRealTimers();
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

describe("Spin engine", () => {
  it("starts a spin with three users and persists its initial event", async () => {
    const { room, users } = await createRoomWithMembers(3);
    const response = await request(app).post(`/api/rooms/${room.id}/spin/start`).send({ userId: users[0].id });

    expect(response.status).toBe(201);
    expect(response.body.spin).toMatchObject({ roomId: room.id, status: "RUNNING" });
    expect(response.body.spin.participants).toHaveLength(3);
    expect(response.body.spin.events).toEqual([
      expect.objectContaining({ type: "SPIN_STARTED", sequence: 1 })
    ]);
  });

  it("rejects a start with fewer than three eligible users", async () => {
    const { room, users } = await createRoomWithMembers(2);
    const response = await request(app).post(`/api/rooms/${room.id}/spin/start`).send({ userId: users[0].id });

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe("INSUFFICIENT_ELIGIBLE_PARTICIPANTS");
  });

  it("rejects more than twenty eligible users", async () => {
    const { room, users } = await createRoomWithMembers(21);
    const response = await request(app).post(`/api/rooms/${room.id}/spin/start`).send({ userId: users[0].id });

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe("TOO_MANY_ELIGIBLE_PARTICIPANTS");
  });

  it("allows only one active spin for concurrent start requests", async () => {
    const { room, users } = await createRoomWithMembers(3);
    const [first, second] = await Promise.all([
      request(app).post(`/api/rooms/${room.id}/spin/start`).send({ userId: users[0].id }),
      request(app).post(`/api/rooms/${room.id}/spin/start`).send({ userId: users[0].id })
    ]);

    expect([first.status, second.status].sort()).toEqual([201, 409]);
    expect(await prisma.spin.count({ where: { roomId: room.id, status: "RUNNING" } })).toBe(1);
  });

  it("eliminates every five seconds, persists ordered events, and selects one winner", async () => {
    vi.useFakeTimers();
    const { room, users } = await createRoomWithMembers(3);
    const spin = await startSpin(room.id, users[0].id);

    // The production scheduler creates one five-second timeout. Clear that timeout
    // here so fake time can drive the persisted transition deterministically.
    clearSpinTimersForTests();
    await vi.advanceTimersByTimeAsync(5_000);
    await processSpinElimination(spin.id);
    let current = await getLatestSpin(room.id);
    expect(current.status).toBe("RUNNING");
    expect(current.participants.filter((participant) => participant.status === "ELIMINATED")).toHaveLength(1);

    await vi.advanceTimersByTimeAsync(5_000);
    await processSpinElimination(spin.id);
    current = await getLatestSpin(room.id);
    expect(current.status).toBe("COMPLETED");
    expect(current.participants.filter((participant) => participant.status === "WINNER")).toHaveLength(1);
    expect(current.winnerId).toBeTruthy();
    expect(current.events.map((event) => event.sequence)).toEqual([1, 2, 3, 4]);
    expect(current.events.map((event) => event.type)).toEqual([
      "SPIN_STARTED",
      "USER_ELIMINATED",
      "USER_ELIMINATED",
      "WINNER_ANNOUNCED"
    ]);
    expect(spin.id).toBe(current.id);
  });

  it("eliminates a member who leaves during a running spin and keeps a valid winner", async () => {
    const { room, users } = await createRoomWithMembers(3);
    await startSpin(room.id, users[0].id);
    await leaveRoom(room.id, users[1].id);

    const current = await getLatestSpin(room.id);
    const departed = current.participants.find((participant) => participant.userId === users[1].id);
    expect(departed).toMatchObject({ status: "ELIMINATED" });
    expect(current.winnerId).not.toBe(users[1].id);
  });

  it("returns current spin state to a reconnecting member through room_state", async () => {
    const { room, users } = await createRoomWithMembers(3);
    const spin = await startSpin(room.id, users[0].id);
    const socket = await connectSocket();
    const state = waitForEvent<{ spin: { id: string; status: string } }>(socket, "room_state");
    socket.emit("room:join", { roomId: room.id, userId: users[1].id });
    await expect(state).resolves.toMatchObject({ spin: { id: spin.id, status: "RUNNING" } });
  });

  it("broadcasts the persisted start, elimination, and winner sequence", async () => {
    const { room, users } = await createRoomWithMembers(3);
    const socket = await connectSocket();
    const roomState = waitForEvent(socket, "room_state");
    socket.emit("room:join", { roomId: room.id, userId: users[0].id });
    await roomState;

    const started = waitForEvent<{ spin: { id: string } }>(socket, "spin_started");
    const spin = await startSpin(room.id, users[0].id);
    await expect(started).resolves.toMatchObject({ roomId: room.id, spin: { id: spin.id } });
    clearSpinTimersForTests();

    const firstElimination = waitForEvent<{ userId: string; sequence: number }>(socket, "user_eliminated");
    const firstOutcome = await processSpinElimination(spin.id);
    await expect(firstElimination).resolves.toMatchObject({
      userId: firstOutcome?.eliminated?.userId,
      sequence: firstOutcome?.eliminated?.sequence
    });

    const secondElimination = waitForEvent<{ userId: string; sequence: number }>(socket, "user_eliminated");
    const winner = waitForEvent<{ userId: string; sequence: number }>(socket, "winner_announced");
    const secondOutcome = await processSpinElimination(spin.id);
    await expect(secondElimination).resolves.toMatchObject({
      userId: secondOutcome?.eliminated?.userId,
      sequence: secondOutcome?.eliminated?.sequence
    });
    await expect(winner).resolves.toMatchObject({
      userId: secondOutcome?.winner?.userId,
      sequence: secondOutcome?.winner?.sequence
    });
  });
});
