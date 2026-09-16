import "dotenv/config";

import request from "supertest";
import { afterAll, afterEach, describe, expect, it } from "vitest";

import app from "../src/app.js";
import { getPrismaClient } from "../src/config/database.js";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required to run API integration tests.");
}

const prisma = getPrismaClient();
let createdUserIds: string[] = [];
let createdRoomIds: string[] = [];

async function createUser(name: string) {
  const response = await request(app).post("/api/users").send({ name });
  expect(response.status).toBe(201);
  createdUserIds.push(response.body.id);
  return response.body as { id: string; name: string; createdAt: string };
}

async function createRoom(userId: string) {
  const response = await request(app).post("/api/rooms").send({ userId });
  expect(response.status).toBe(201);
  createdRoomIds.push(response.body.room.id);
  return response.body as {
    room: { id: string; code: string; ownerId: string; status: string };
    participants: Array<{ userId: string; name: string; status: string }>;
  };
}

afterEach(async () => {
  if (createdRoomIds.length > 0) {
    await prisma.roomMember.deleteMany({ where: { roomId: { in: createdRoomIds } } });
    await prisma.room.deleteMany({ where: { id: { in: createdRoomIds } } });
  }

  if (createdUserIds.length > 0) {
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
  }

  createdUserIds = [];
  createdRoomIds = [];
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("Phase 3 user and room APIs", () => {
  it("creates a trimmed user and rejects an empty name", async () => {
    const created = await request(app).post("/api/users").send({ name: "  Munaf  " });
    expect(created.status).toBe(201);
    createdUserIds.push(created.body.id);
    expect(created.body).toMatchObject({ id: expect.any(String), name: "Munaf", createdAt: expect.any(String) });

    const invalid = await request(app).post("/api/users").send({ name: "   " });
    expect(invalid.status).toBe(400);
    expect(invalid.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("creates a room with the creator as owner and active member", async () => {
    const owner = await createUser("Owner");
    const result = await createRoom(owner.id);

    expect(result.room).toMatchObject({ ownerId: owner.id, status: "ACTIVE" });
    expect(result.room.code).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);
    expect(result.participants).toEqual([{ userId: owner.id, name: "Owner", status: "ACTIVE" }]);
  });

  it("joins a room without creating duplicate membership rows", async () => {
    const owner = await createUser("Owner");
    const member = await createUser("Member");
    const room = await createRoom(owner.id);

    const joined = await request(app).post(`/api/rooms/${room.room.code}/join`).send({ userId: member.id });
    expect(joined.status).toBe(200);
    expect(joined.body.participants).toHaveLength(2);

    const repeated = await request(app).post(`/api/rooms/${room.room.code}/join`).send({ userId: member.id });
    expect(repeated.status).toBe(200);
    expect(repeated.body.message).toBe("User is already an active room member.");

    await expect(
      prisma.roomMember.create({
        data: { roomId: room.room.id, userId: member.id, status: "ACTIVE" }
      })
    ).rejects.toMatchObject({ code: "P2002" });

    expect(
      await prisma.roomMember.count({ where: { roomId: room.room.id, userId: member.id } })
    ).toBe(1);
  });

  it("allows a left member to rejoin using the same membership record", async () => {
    const owner = await createUser("Owner");
    const member = await createUser("Member");
    const room = await createRoom(owner.id);
    await request(app).post(`/api/rooms/${room.room.code}/join`).send({ userId: member.id });

    const left = await request(app).post(`/api/rooms/${room.room.id}/leave`).send({ userId: member.id });
    expect(left.status).toBe(200);
    expect(left.body.participants).toHaveLength(1);

    const rejoined = await request(app).post(`/api/rooms/${room.room.code}/join`).send({ userId: member.id });
    expect(rejoined.status).toBe(200);
    expect(rejoined.body.participants).toHaveLength(2);
    expect(await prisma.roomMember.count({ where: { roomId: room.room.id, userId: member.id } })).toBe(1);
  });

  it("leaves idempotently without deleting membership history", async () => {
    const owner = await createUser("Owner");
    const member = await createUser("Member");
    const room = await createRoom(owner.id);
    await request(app).post(`/api/rooms/${room.room.code}/join`).send({ userId: member.id });

    const firstLeave = await request(app).post(`/api/rooms/${room.room.id}/leave`).send({ userId: member.id });
    expect(firstLeave.status).toBe(200);
    expect(firstLeave.body.message).toBe("Left room.");

    const repeatedLeave = await request(app).post(`/api/rooms/${room.room.id}/leave`).send({ userId: member.id });
    expect(repeatedLeave.status).toBe(200);
    expect(repeatedLeave.body.message).toBe("User has already left the room.");

    expect(
      await prisma.roomMember.findUnique({ where: { roomId_userId: { roomId: room.room.id, userId: member.id } } })
    ).toMatchObject({ status: "LEFT", isConnected: false, leftAt: expect.any(Date) });
  });

  it("returns 404 for unknown rooms and users", async () => {
    const user = await createUser("User");

    const unknownRoom = await request(app).get("/api/rooms/missing-room");
    expect(unknownRoom.status).toBe(404);
    expect(unknownRoom.body.error.code).toBe("ROOM_NOT_FOUND");

    const unknownUser = await request(app).post("/api/rooms").send({ userId: "missing-user" });
    expect(unknownUser.status).toBe(404);
    expect(unknownUser.body.error.code).toBe("USER_NOT_FOUND");
    expect(user.id).toEqual(expect.any(String));
  });

  it("does not allow joining a closed room", async () => {
    const owner = await createUser("Owner");
    const member = await createUser("Member");
    const room = await createRoom(owner.id);
    await prisma.room.update({ where: { id: room.room.id }, data: { status: "CLOSED" } });

    const response = await request(app).post(`/api/rooms/${room.room.code}/join`).send({ userId: member.id });
    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe("ROOM_CLOSED");
  });

  it("returns an authoritative active participant list", async () => {
    const owner = await createUser("Owner");
    const member = await createUser("Member");
    const room = await createRoom(owner.id);
    await request(app).post(`/api/rooms/${room.room.code}/join`).send({ userId: member.id });

    const response = await request(app).get(`/api/rooms/${room.room.id}`);
    expect(response.status).toBe(200);
    expect(response.body.room).toMatchObject({ id: room.room.id, code: room.room.code, ownerId: owner.id });
    expect(response.body.participants).toEqual(
      expect.arrayContaining([
        { userId: owner.id, name: "Owner", status: "ACTIVE" },
        { userId: member.id, name: "Member", status: "ACTIVE" }
      ])
    );
  });
});
