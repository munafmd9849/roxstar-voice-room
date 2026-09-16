import { randomBytes } from "node:crypto";

import { getPrismaClient } from "../config/database.js";
import { AppError } from "../errors/app-error.js";
import { mapSpinState, type SpinState } from "./spin-state.js";

const ROOM_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const ROOM_CODE_LENGTH = 6;
const MAX_ROOM_CODE_ATTEMPTS = 8;

type RoomState = {
  room: {
    id: string;
    code: string;
    ownerId: string;
    status: "ACTIVE" | "CLOSED";
    createdAt: Date;
    updatedAt: Date;
  };
  participants: Array<{
    userId: string;
    name: string;
    status: "ACTIVE";
  }>;
  spin: SpinState | null;
};

function generateRoomCode(): string {
  const bytes = randomBytes(ROOM_CODE_LENGTH);

  return Array.from(bytes, (byte) => ROOM_CODE_ALPHABET[byte % ROOM_CODE_ALPHABET.length]).join("");
}

function isUniqueConstraintError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
}

async function requireUser(userId: string): Promise<{ id: string; name: string }> {
  const user = await getPrismaClient().user.findUnique({
    where: { id: userId },
    select: { id: true, name: true }
  });

  if (!user) {
    throw new AppError(404, "USER_NOT_FOUND", "User was not found.");
  }

  return user;
}

async function requireRoom(roomId: string) {
  const room = await getPrismaClient().room.findUnique({ where: { id: roomId } });

  if (!room) {
    throw new AppError(404, "ROOM_NOT_FOUND", "Room was not found.");
  }

  return room;
}

export async function verifyActiveRoomMembership(roomId: string, userId: string) {
  const user = await requireUser(userId);
  const room = await requireRoom(roomId);
  const membership = await getPrismaClient().roomMember.findUnique({
    where: { roomId_userId: { roomId, userId } },
    select: { status: true }
  });

  if (membership?.status !== "ACTIVE") {
    throw new AppError(403, "NOT_A_ROOM_MEMBER", "User is not an active room member.");
  }

  return { user, room };
}

export async function getRoomState(roomId: string): Promise<RoomState> {
  const room = await getPrismaClient().room.findUnique({
    where: { id: roomId },
    select: {
      id: true,
      code: true,
      ownerId: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      members: {
        where: { status: "ACTIVE" },
        orderBy: { joinedAt: "asc" },
        select: {
          userId: true,
          status: true,
          user: { select: { name: true } }
        }
      },
      spins: {
        orderBy: { startedAt: "desc" },
        take: 1,
        include: {
          winner: { select: { id: true, name: true } },
          participants: { include: { user: { select: { name: true } } } },
          events: true
        }
      }
    }
  });

  if (!room) {
    throw new AppError(404, "ROOM_NOT_FOUND", "Room was not found.");
  }

  return {
    room: {
      id: room.id,
      code: room.code,
      ownerId: room.ownerId,
      status: room.status,
      createdAt: room.createdAt,
      updatedAt: room.updatedAt
    },
    participants: room.members.map((member) => ({
      userId: member.userId,
      name: member.user.name,
      status: "ACTIVE"
    })),
    spin: room.spins[0] ? mapSpinState(room.spins[0]) : null
  };
}

export async function createRoom(userId: string): Promise<RoomState> {
  await requireUser(userId);
  const prisma = getPrismaClient();

  for (let attempt = 0; attempt < MAX_ROOM_CODE_ATTEMPTS; attempt += 1) {
    const code = generateRoomCode();

    try {
      const room = await prisma.$transaction(async (transaction) => {
        const createdRoom = await transaction.room.create({
          data: { code, ownerId: userId }
        });

        await transaction.roomMember.create({
          data: {
            roomId: createdRoom.id,
            userId,
            status: "ACTIVE",
            // HTTP membership is not a realtime socket presence signal.
            isConnected: false
          }
        });

        return createdRoom;
      });

      return getRoomState(room.id);
    } catch (error) {
      if (!isUniqueConstraintError(error)) {
        throw error;
      }

      if (attempt === MAX_ROOM_CODE_ATTEMPTS - 1) {
        throw new AppError(409, "ROOM_CODE_CONFLICT", "Unable to generate a unique room code.");
      }
    }
  }

  throw new AppError(409, "ROOM_CODE_CONFLICT", "Unable to generate a unique room code.");
}

export async function joinRoom(roomCode: string, userId: string): Promise<RoomState & { alreadyMember: boolean }> {
  await requireUser(userId);
  const prisma = getPrismaClient();
  const room = await prisma.room.findUnique({
    where: { code: roomCode },
    select: { id: true, status: true }
  });

  if (!room) {
    throw new AppError(404, "ROOM_NOT_FOUND", "Room was not found.");
  }

  if (room.status !== "ACTIVE") {
    throw new AppError(409, "ROOM_CLOSED", "Room is closed and cannot be joined.");
  }

  const existingMembership = await prisma.roomMember.findUnique({
    where: { roomId_userId: { roomId: room.id, userId } },
    select: { status: true }
  });

  if (existingMembership?.status === "ACTIVE") {
    return { ...(await getRoomState(room.id)), alreadyMember: true };
  }

  try {
    await prisma.roomMember.upsert({
      where: { roomId_userId: { roomId: room.id, userId } },
      create: {
        roomId: room.id,
        userId,
        status: "ACTIVE",
        isConnected: false
      },
      update: {
        status: "ACTIVE",
        isConnected: false,
        joinedAt: new Date(),
        leftAt: null
      }
    });
  } catch (error) {
    if (!isUniqueConstraintError(error)) {
      throw error;
    }

    await prisma.roomMember.update({
      where: { roomId_userId: { roomId: room.id, userId } },
      data: { status: "ACTIVE", isConnected: false, joinedAt: new Date(), leftAt: null }
    });
  }

  return { ...(await getRoomState(room.id)), alreadyMember: false };
}

export async function leaveRoom(roomId: string, userId: string): Promise<RoomState & { alreadyLeft: boolean }> {
  await requireRoom(roomId);
  const prisma = getPrismaClient();
  const membership = await prisma.roomMember.findUnique({
    where: { roomId_userId: { roomId, userId } },
    select: { status: true }
  });

  if (!membership) {
    throw new AppError(404, "MEMBERSHIP_NOT_FOUND", "Room membership was not found.");
  }

  if (membership.status === "LEFT") {
    return { ...(await getRoomState(roomId)), alreadyLeft: true };
  }

  await prisma.roomMember.update({
    where: { roomId_userId: { roomId, userId } },
    data: { status: "LEFT", isConnected: false, leftAt: new Date() }
  });
  const { handleSpinParticipantDeparture } = await import("./spin.service.js");
  await handleSpinParticipantDeparture(roomId, userId);

  return { ...(await getRoomState(roomId)), alreadyLeft: false };
}
