export type SpinState = {
  id: string;
  roomId: string;
  status: "WAITING" | "RUNNING" | "COMPLETED" | "ABORTED";
  startedAt: Date | null;
  completedAt: Date | null;
  winnerId: string | null;
  version: number;
  winner: { id: string; name: string } | null;
  participants: Array<{
    userId: string;
    name: string;
    status: "ACTIVE" | "ELIMINATED" | "WINNER";
    position: number;
    eliminationOrder: number | null;
    eliminatedAt: Date | null;
  }>;
  events: Array<{
    type: "SPIN_STARTED" | "USER_ELIMINATED" | "WINNER_ANNOUNCED" | "SPIN_ABORTED";
    userId: string | null;
    sequence: number;
    metadata: unknown;
    createdAt: Date;
  }>;
};

type SpinRecord = {
  id: string;
  roomId: string;
  status: string;
  startedAt: Date | null;
  completedAt: Date | null;
  winnerId: string | null;
  version: number;
  winner: { id: string; name: string } | null;
  participants: Array<{
    userId: string;
    status: string;
    position: number;
    eliminationOrder: number | null;
    eliminatedAt: Date | null;
    user: { name: string };
  }>;
  events: Array<{
    type: string;
    userId: string | null;
    sequence: number;
    metadata: unknown;
    createdAt: Date;
  }>;
};

export function mapSpinState(spin: SpinRecord): SpinState {
  return {
    id: spin.id,
    roomId: spin.roomId,
    status: spin.status as SpinState["status"],
    startedAt: spin.startedAt,
    completedAt: spin.completedAt,
    winnerId: spin.winnerId,
    version: spin.version,
    winner: spin.winner,
    participants: spin.participants
      .sort((left, right) => left.position - right.position)
      .map((participant) => ({
        userId: participant.userId,
        name: participant.user.name,
        status: participant.status as SpinState["participants"][number]["status"],
        position: participant.position,
        eliminationOrder: participant.eliminationOrder,
        eliminatedAt: participant.eliminatedAt
      })),
    events: spin.events
      .sort((left, right) => left.sequence - right.sequence)
      .map((event) => ({
        type: event.type as SpinState["events"][number]["type"],
        userId: event.userId,
        sequence: event.sequence,
        metadata: event.metadata,
        createdAt: event.createdAt
      }))
  };
}
