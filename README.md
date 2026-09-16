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
through REST is membership management, not Socket.IO presence. Realtime events and
the Socket.IO presence model are not implemented yet.

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
