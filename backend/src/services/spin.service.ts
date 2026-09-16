import { randomInt } from "node:crypto";

import { getPrismaClient } from "../config/database.js";
import { AppError } from "../errors/app-error.js";
import { broadcastSpinRoomState, broadcastSpinStarted, broadcastUserEliminated, broadcastWinnerAnnounced } from "../socket/rooms/spin-broadcast.js";
import { getRoomState } from "./room.service.js";
import { mapSpinState, type SpinState } from "./spin-state.js";

const MIN_ELIGIBLE_PARTICIPANTS = 3;
const MAX_ELIGIBLE_PARTICIPANTS = 20;
const ELIMINATION_INTERVAL_MS = 5_000;
const scheduledSpinTimers = new Map<string, NodeJS.Timeout>();
const processingSpins = new Set<string>();

const spinInclude = {
  winner: { select: { id: true, name: true } },
  participants: {
    include: { user: { select: { name: true } } }
  },
  events: true
} as const;

type EliminationOutcome = {
  spin: SpinState;
  eliminated?: { userId: string; sequence: number; eliminatedAt: Date };
  winner?: { userId: string; sequence: number; completedAt: Date };
  aborted?: boolean;
};

async function lockTransaction(transaction: { $executeRaw: (query: TemplateStringsArray, ...values: unknown[]) => Promise<unknown> }, key: string) {
  await transaction.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${key}))`;
}

function nextTimer(spinId: string) {
  if (scheduledSpinTimers.has(spinId)) {
    return;
  }

  const timer = setTimeout(async () => {
    scheduledSpinTimers.delete(spinId);
    try {
      const outcome = await processSpinElimination(spinId);

      if (outcome?.spin.status === "RUNNING") {
        nextTimer(spinId);
      }
    } catch (error) {
      console.error("Spin timer error", { spinId, message: error instanceof Error ? error.message : "Unknown error" });
    }
  }, ELIMINATION_INTERVAL_MS);

  scheduledSpinTimers.set(spinId, timer);
}

function clearTimer(spinId: string) {
  const timer = scheduledSpinTimers.get(spinId);
  if (timer) {
    clearTimeout(timer);
    scheduledSpinTimers.delete(spinId);
  }
}

function publishOutcome(outcome: EliminationOutcome) {
  const { spin } = outcome;
  if (outcome.eliminated) {
    broadcastUserEliminated(spin.roomId, spin.id, outcome.eliminated.userId, outcome.eliminated.sequence, outcome.eliminated.eliminatedAt);
  }
  if (outcome.winner) {
    broadcastWinnerAnnounced(spin.roomId, spin.id, outcome.winner.userId, outcome.winner.sequence, outcome.winner.completedAt);
  }
  void getRoomState(spin.roomId).then((roomState) => broadcastSpinRoomState(spin.roomId, roomState));
}

export async function getLatestSpin(roomId: string): Promise<SpinState> {
  const spin = await getPrismaClient().spin.findFirst({
    where: { roomId },
    orderBy: { startedAt: "desc" },
    include: spinInclude
  });

  if (!spin) {
    throw new AppError(404, "SPIN_NOT_FOUND", "No spin was found for this room.");
  }

  return mapSpinState(spin);
}

export async function startSpin(roomId: string, requesterId: string): Promise<SpinState> {
  const prisma = getPrismaClient();
  const spin = await prisma.$transaction(async (transaction) => {
    await lockTransaction(transaction, roomId);
    const room = await transaction.room.findUnique({ where: { id: roomId }, select: { ownerId: true, status: true } });
    if (!room) {
      throw new AppError(404, "ROOM_NOT_FOUND", "Room was not found.");
    }
    if (room.status !== "ACTIVE") {
      throw new AppError(409, "ROOM_CLOSED", "Room is closed and cannot start a spin.");
    }
    if (room.ownerId !== requesterId) {
      throw new AppError(403, "NOT_ROOM_OWNER", "Only the room owner can start a spin.");
    }
    const ownerMembership = await transaction.roomMember.findUnique({
      where: { roomId_userId: { roomId, userId: requesterId } },
      select: { status: true }
    });
    if (ownerMembership?.status !== "ACTIVE") {
      throw new AppError(403, "NOT_A_ROOM_MEMBER", "Room owner must be an active room member.");
    }

    const activeSpin = await transaction.spin.findFirst({
      where: { roomId, status: { in: ["WAITING", "RUNNING"] } },
      select: { id: true }
    });
    if (activeSpin) {
      throw new AppError(409, "SPIN_ALREADY_RUNNING", "A spin is already active for this room.");
    }

    const eligibleMembers = await transaction.roomMember.findMany({
      where: { roomId, status: "ACTIVE" },
      orderBy: { joinedAt: "asc" },
      select: { userId: true }
    });
    if (eligibleMembers.length < MIN_ELIGIBLE_PARTICIPANTS) {
      throw new AppError(409, "INSUFFICIENT_ELIGIBLE_PARTICIPANTS", "At least three active members are required to start a spin.");
    }
    if (eligibleMembers.length > MAX_ELIGIBLE_PARTICIPANTS) {
      throw new AppError(409, "TOO_MANY_ELIGIBLE_PARTICIPANTS", "A spin can include at most twenty active members.");
    }

    const startedAt = new Date();
    const created = await transaction.spin.create({
      data: {
        roomId,
        status: "WAITING",
        participants: {
          create: eligibleMembers.map((member, index) => ({ userId: member.userId, position: index + 1, status: "ACTIVE" }))
        }
      },
      select: { id: true }
    });
    await transaction.spinEvent.create({
      data: { spinId: created.id, type: "SPIN_STARTED", sequence: 1, metadata: { participantCount: eligibleMembers.length } }
    });
    await transaction.spin.update({
      where: { id: created.id },
      data: { status: "RUNNING", startedAt }
    });

    return transaction.spin.findUniqueOrThrow({ where: { id: created.id }, include: spinInclude });
  });

  const state = mapSpinState(spin);
  broadcastSpinStarted(roomId, state);
  void getRoomState(roomId).then((roomState) => broadcastSpinRoomState(roomId, roomState));
  nextTimer(state.id);
  return state;
}

export async function processSpinElimination(spinId: string, departureUserId?: string): Promise<EliminationOutcome | undefined> {
  if (processingSpins.has(spinId)) {
    return undefined;
  }
  processingSpins.add(spinId);

  try {
    const outcome = await getPrismaClient().$transaction(async (transaction) => {
      await lockTransaction(transaction, spinId);
      const spin = await transaction.spin.findUnique({ where: { id: spinId }, include: spinInclude });
      if (!spin || spin.status !== "RUNNING") {
        return undefined;
      }

      const activeParticipants = spin.participants.filter((participant) => participant.status === "ACTIVE");
      const activeMembers = await transaction.roomMember.findMany({
        where: { roomId: spin.roomId, status: "ACTIVE" },
        select: { userId: true }
      });
      const activeMemberIds = new Set(activeMembers.map((member) => member.userId));
      const validParticipants = activeParticipants.filter((participant) => activeMemberIds.has(participant.userId));
      const invalidParticipants = activeParticipants.filter((participant) => !activeMemberIds.has(participant.userId));

      if (validParticipants.length === 0) {
        const completedAt = new Date();
        const sequence = spin.events.length + 1;
        await transaction.spin.update({ where: { id: spin.id }, data: { status: "ABORTED", completedAt, version: { increment: 1 } } });
        await transaction.spinEvent.create({ data: { spinId: spin.id, type: "SPIN_ABORTED", sequence, metadata: { reason: "NO_ELIGIBLE_PARTICIPANTS" } } });
        const aborted = await transaction.spin.findUniqueOrThrow({ where: { id: spin.id }, include: spinInclude });
        return { spin: mapSpinState(aborted), aborted: true } satisfies EliminationOutcome;
      }

      if (validParticipants.length === 1) {
        const completedAt = new Date();
        const winnerSequence = spin.events.length + 1;
        await transaction.spinParticipant.update({
          where: { spinId_userId: { spinId: spin.id, userId: validParticipants[0].userId } },
          data: { status: "WINNER" }
        });
        await transaction.spin.update({
          where: { id: spin.id },
          data: { status: "COMPLETED", winnerId: validParticipants[0].userId, completedAt, version: { increment: 1 } }
        });
        await transaction.spinEvent.create({
          data: { spinId: spin.id, type: "WINNER_ANNOUNCED", userId: validParticipants[0].userId, sequence: winnerSequence }
        });
        const completed = await transaction.spin.findUniqueOrThrow({ where: { id: spin.id }, include: spinInclude });
        return {
          spin: mapSpinState(completed),
          winner: { userId: validParticipants[0].userId, sequence: winnerSequence, completedAt }
        } satisfies EliminationOutcome;
      }

      const departingParticipant = departureUserId
        ? activeParticipants.find((participant) => participant.userId === departureUserId)
        : undefined;
      const candidate = departingParticipant ?? invalidParticipants[0] ?? validParticipants[randomInt(validParticipants.length)];
      const eliminatedAt = new Date();
      const eliminationSequence = spin.events.length + 1;
      const eliminationOrder = spin.participants.filter((participant) => participant.status === "ELIMINATED").length + 1;
      await transaction.spinParticipant.update({
        where: { spinId_userId: { spinId: spin.id, userId: candidate.userId } },
        data: { status: "ELIMINATED", eliminatedAt, eliminationOrder }
      });
      await transaction.spinEvent.create({
        data: { spinId: spin.id, type: "USER_ELIMINATED", userId: candidate.userId, sequence: eliminationSequence }
      });

      const remaining = validParticipants.filter((participant) => participant.userId !== candidate.userId);
      let winner: EliminationOutcome["winner"];
      if (remaining.length === 1) {
        const completedAt = new Date();
        const winnerSequence = eliminationSequence + 1;
        await transaction.spinParticipant.update({
          where: { spinId_userId: { spinId: spin.id, userId: remaining[0].userId } },
          data: { status: "WINNER" }
        });
        await transaction.spin.update({
          where: { id: spin.id },
          data: { status: "COMPLETED", winnerId: remaining[0].userId, completedAt, version: { increment: 1 } }
        });
        await transaction.spinEvent.create({
          data: { spinId: spin.id, type: "WINNER_ANNOUNCED", userId: remaining[0].userId, sequence: winnerSequence }
        });
        winner = { userId: remaining[0].userId, sequence: winnerSequence, completedAt };
      }

      const updated = await transaction.spin.findUniqueOrThrow({ where: { id: spin.id }, include: spinInclude });
      return {
        spin: mapSpinState(updated),
        eliminated: { userId: candidate.userId, sequence: eliminationSequence, eliminatedAt },
        ...(winner ? { winner } : {})
      } satisfies EliminationOutcome;
    });

    if (outcome) {
      if (outcome.spin.status !== "RUNNING") {
        clearTimer(spinId);
      }
      publishOutcome(outcome);
    }
    return outcome;
  } finally {
    processingSpins.delete(spinId);
  }
}

export async function handleSpinParticipantDeparture(roomId: string, userId: string) {
  const spin = await getPrismaClient().spin.findFirst({
    where: { roomId, status: "RUNNING", participants: { some: { userId, status: "ACTIVE" } } },
    select: { id: true }
  });
  if (spin) {
    await processSpinElimination(spin.id, userId);
  }
}

export function clearSpinTimersForTests() {
  for (const spinId of scheduledSpinTimers.keys()) {
    clearTimer(spinId);
  }
}
