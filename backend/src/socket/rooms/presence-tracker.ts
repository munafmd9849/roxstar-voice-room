type SocketPresence = {
  roomId: string;
  userId: string;
};

export type RemovedPresence = SocketPresence & {
  isLastSocketForUser: boolean;
};

/**
 * Tracks sockets in this backend process. PostgreSQL remains the authority for
 * membership, while this tracker prevents multi-tab connections from clearing
 * presence until the user's final socket has left.
 */
export class PresenceTracker {
  private readonly socketRooms = new Map<string, Map<string, string>>();
  private readonly memberSockets = new Map<string, Set<string>>();

  getUserForSocketRoom(socketId: string, roomId: string): string | undefined {
    return this.socketRooms.get(socketId)?.get(roomId);
  }

  add(socketId: string, roomId: string, userId: string): { alreadyPresent: boolean; isFirstSocketForUser: boolean } {
    const rooms = this.socketRooms.get(socketId) ?? new Map<string, string>();
    const existingUserId = rooms.get(roomId);

    if (existingUserId === userId) {
      return { alreadyPresent: true, isFirstSocketForUser: false };
    }

    if (existingUserId) {
      throw new Error("Socket already has a different user identity for this room.");
    }

    rooms.set(roomId, userId);
    this.socketRooms.set(socketId, rooms);

    const key = this.memberKey(roomId, userId);
    const sockets = this.memberSockets.get(key) ?? new Set<string>();
    const isFirstSocketForUser = sockets.size === 0;
    sockets.add(socketId);
    this.memberSockets.set(key, sockets);

    return { alreadyPresent: false, isFirstSocketForUser };
  }

  remove(socketId: string, roomId: string): RemovedPresence | undefined {
    const rooms = this.socketRooms.get(socketId);
    const userId = rooms?.get(roomId);

    if (!rooms || !userId) {
      return undefined;
    }

    rooms.delete(roomId);
    if (rooms.size === 0) {
      this.socketRooms.delete(socketId);
    }

    const key = this.memberKey(roomId, userId);
    const sockets = this.memberSockets.get(key);
    sockets?.delete(socketId);
    const isLastSocketForUser = !sockets || sockets.size === 0;

    if (isLastSocketForUser) {
      this.memberSockets.delete(key);
    }

    return { roomId, userId, isLastSocketForUser };
  }

  removeSocket(socketId: string): RemovedPresence[] {
    const rooms = this.socketRooms.get(socketId);
    if (!rooms) {
      return [];
    }

    return [...rooms.keys()].flatMap((roomId) => {
      const removed = this.remove(socketId, roomId);
      return removed ? [removed] : [];
    });
  }

  private memberKey(roomId: string, userId: string): string {
    return `${roomId}:${userId}`;
  }
}
