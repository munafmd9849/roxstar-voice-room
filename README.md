# RoxStar Voice Room

## Phase 2: local database setup

This phase provides the PostgreSQL and Prisma database foundation only. Room APIs,
audio upload/storage, Socket.IO, the spin engine, Android, CI/CD, and deployment
are not implemented yet.

### Requirements

- Node.js 22+
- Docker with Docker Compose

### Start PostgreSQL

```bash
docker compose -f infrastructure/docker-compose.yml up -d
```

The local database uses `roxstar` for both the database and user. Its development-only
connection string is included in `backend/.env.example`. Copy its values into your
local environment without committing a `backend/.env` file.

### Configure and migrate the backend

```bash
cd backend
npm install
export DATABASE_URL='postgresql://roxstar:roxstar_local_dev@localhost:5432/roxstar?schema=public'
npx prisma generate
npx prisma migrate dev --name init
npx prisma migrate status
```

To run the backend:

```bash
npm run dev
```

The existing health endpoint remains available at `GET http://localhost:3000/health`.

## Phase 3: User and Room REST APIs

Start PostgreSQL and configure `DATABASE_URL` as above, then run the API with
`npm run dev` from `backend`. The API is PostgreSQL-backed and authoritative: room
state is read from the database for every response.

`RoomMember.isConnected` remains `false` for all HTTP operations. Joining or leaving
through REST is membership management, not Socket.IO presence.

### Create user

`POST /api/users` creates an unauthenticated user for the current development flow.

```json
{ "name": "Munaf" }
```

It returns `201` with `{ "id": "...", "name": "Munaf", "createdAt": "..." }`.
An empty, non-string, or over-100-character name returns `400 VALIDATION_ERROR`.

### Create room

`POST /api/rooms` creates an active room and its owner's active membership atomically.

```json
{ "userId": "user-id" }
```

It returns `201` with a `room` (including an uppercase six-character `code`) and
its initial `participants` list. An unknown user returns `404 USER_NOT_FOUND`.

### Join room

`POST /api/rooms/:roomCode/join` joins an active room, or reactivates a prior
membership without creating a duplicate row.

```json
{ "userId": "user-id" }
```

It returns `200` with the current room and active participants. Repeating a join by
an active member is safe and returns an explanatory message. Unknown users/rooms
return `404`; closed rooms return `409 ROOM_CLOSED`.

### Leave room

`POST /api/rooms/:roomId/leave` marks a membership as `LEFT`; it does not delete
membership history.

```json
{ "userId": "user-id" }
```

It returns `200` with the current active participants. Repeating the request is
safe and returns an explanatory message. Unknown rooms or memberships return `404`.

### Get room state

`GET /api/rooms/:roomId` returns the authoritative room ID, code, owner, status,
timestamps, and active participants (`userId`, `name`, `status`). It returns
`404 ROOM_NOT_FOUND` for an unknown room.

### Run tests

Tests use the configured local PostgreSQL database and clean up only records they
create. With `DATABASE_URL` available:

```bash
cd backend
npm test
```

## Phase 4: Socket.IO room presence

Socket.IO runs on the same HTTP server and port as Express. REST APIs remain the
authoritative way to create, join, and leave room memberships. A socket cannot create
or delete a membership; it can establish realtime presence only after the user is an
active `RoomMember` created through the REST API.

### Client to server events

- `room:join` — joins realtime presence after validating active membership:

  ```json
  { "roomId": "room-id", "userId": "user-id" }
  ```

- `room:leave` — leaves realtime presence without changing membership:

  ```json
  { "roomId": "room-id" }
  ```

- `room:state` — requests authoritative database state for a room the socket joined:

  ```json
  { "roomId": "room-id" }
  ```

### Server to client events

- `room_state` — matches `GET /api/rooms/:roomId`:

  ```json
  { "room": { "id": "...", "code": "...", "ownerId": "...", "status": "ACTIVE" }, "participants": [] }
  ```

- `user_joined` — emitted to other sockets when a user first becomes present:

  ```json
  { "roomId": "...", "userId": "...", "name": "Munaf", "joinedAt": "2026-09-16T00:00:00.000Z" }
  ```

- `user_left` — emitted only after a user's final socket leaves:

  ```json
  { "roomId": "...", "userId": "...", "leftAt": "2026-09-16T00:00:00.000Z" }
  ```

- `socket:error` — structured validation, access, and server errors.

Reconnect by sending `room:join` again. The server revalidates the active membership,
updates presence, and sends a new authoritative `room_state`. Multiple sockets for one
user keep `isConnected` true until the last socket leaves; disconnecting never changes
membership status to `LEFT`.

Phase 4 does **not** implement `draft_shared`, `spin_started`, `user_eliminated`, or
`winner_announced`; those events and their business behavior belong to later phases.

### Manual Socket.IO check

Create two active room members using the REST APIs, then run the backend and launch a
client for each member in separate terminals:

```bash
cd backend
npm run dev
npm run socket:manual -- <roomId> <userId-for-client-a>
npm run socket:manual -- <roomId> <userId-for-client-b>
```

Client A receives `user_joined` when B joins and `user_left` when B exits. Restart B's
client and it sends `room:join` again, receiving the latest `room_state`.

## Spin engine

The room owner starts a spin with:

```http
POST /api/rooms/:roomId/spin/start
Content-Type: application/json

{ "userId": "owner-user-id" }
```

`GET /api/rooms/:roomId/spin` returns the latest spin, its participant statuses,
winner, timestamps, and ordered event history.

### Lifecycle and eligibility

- A room must be `ACTIVE`; its owner must also be an active room member.
- Exactly 3–20 active members are eligible. More than 20 members is rejected rather
  than silently excluding people.
- The persisted lifecycle is `WAITING` → `RUNNING` → `COMPLETED`, with `ABORTED`
  reserved for a running spin that has no valid eligible participant left.
- A per-spin timer eliminates one participant every five seconds. The final remaining
  eligible participant is persisted as the single winner.
- Events are persisted before broadcast, with deterministic sequences: `SPIN_STARTED`,
  `USER_ELIMINATED` for each elimination, then `WINNER_ANNOUNCED` (or `SPIN_ABORTED`).

### Realtime spin events

Sockets already present in `room:<roomId>` receive `spin_started`,
`user_eliminated`, and `winner_announced`. `room_state` now includes the latest spin,
so reconnecting clients can issue the existing `room:join` / `room:state` flow and
recover the authoritative state.

If a member leaves through the REST API during a running spin, that participant is
immediately persisted as eliminated; membership remains historical and the spin
continues with valid active members. This prevents a departed member from winning.
Only one active (`WAITING` or `RUNNING`) spin can be created for a room at a time.
