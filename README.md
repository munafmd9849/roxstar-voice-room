# RoxStar Voice Room

Android voice drafts, realtime rooms, and a backend-owned spin wheel.

Audio stays on the phone (Oboe → echo → WAV). The Node backend is authoritative for rooms, draft metadata, and spin eliminations. PostgreSQL is the source of truth.

| Area | Points | Status |
| --- | --- | --- |
| Android Audio Studio / Oboe | 40 | Done |
| Room + Realtime | 40 | Done |
| Spin Wheel | 50 | Done |
| Backend + Database | 30 | Done (25/25 tests) |
| Cloud + DevOps | 20 | Docker + GitHub Actions done; **public HTTPS URL still needed** |
| Documentation + Communication | 20 | Done |

### Left before submission

1. **Host the backend** on AWS, GCP, or Azure and paste the HTTPS URL into the Android **Backend URL** field. Local Docker is not the hosted endpoint. See `docs/deployment.md`.
2. **Record the 5–10 minute demo** using the checklist in `docs/demo.md`.

### Quick start

```bash
docker compose -f infrastructure/docker-compose.yml up -d --build
curl http://localhost:3000/health
cd android-app && ./gradlew assembleDebug
```

Emulator backend URL: `http://10.0.2.2:3000`  
Phone on the same Wi‑Fi: `http://YOUR-LAN-IP:3000`

Layout: `android-app/` · `android-app/app/src/main/cpp/` (Oboe) · `backend/` · `database/` · `infrastructure/` · `docs/`

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

## Android app

The Android client lives in `android-app/`. It records locally with Oboe, stores drafts on-device, and talks to the existing backend over REST and Socket.IO. Audio bytes are never uploaded.

### Audio flow

```
Microphone → Oboe → Echo → PCM/WAV → app-private storage → local Draft → playback
```

### Room flow

```
Android → REST / Socket.IO → Node backend → PostgreSQL
```

The backend remains authoritative for membership, shared draft metadata, and spin elimination. Android does not run a second spin timer.

### Requirements

- JDK 17+ (this machine uses Java 21)
- Android SDK with platform 35, Build-Tools, NDK 27.2.12479018, and CMake 3.30.5
- Kotlin 2.1 (provided by the Gradle plugins)

### Build

```bash
cd android-app
./gradlew assembleDebug
```

Install the debug APK from `android-app/app/build/outputs/apk/debug/app-debug.apk`.

### Run

1. Start PostgreSQL and the backend (`cd backend && npm run dev`).
2. Install the app on an emulator or device.
3. On first launch, enter a display name. The app calls `POST /api/users` and stores the returned `userId`.
4. Allow microphone permission when recording.

### Backend URL

The compile-time default is `BuildConfig.API_BASE_URL` in `android-app/app/build.gradle.kts`:

- Android emulator: `http://10.0.2.2:3000`
- Physical device: `http://YOUR-UBUNTU-LAN-IP:3000` (example: `http://192.168.1.15:3000`)

Change it in two places if needed:

1. `buildConfigField("String", "API_BASE_URL", "\"http://10.0.2.2:3000\"")` for a new default
2. The in-app **Backend URL** field on the first-launch and Home screens (saved locally and reused by REST and Socket.IO)

Cleartext HTTP is enabled for local development only.

### Native / Oboe

Native sources are under `android-app/app/src/main/cpp/`:

- `recorder.cpp` — Oboe input stream, start/stop/cancel, recording states
- `echo_processor.cpp` — delay-line echo (~250 ms, decay 0.4)
- `wav_writer.cpp` — mono 16-bit PCM WAV
- `jni_bridge.cpp` — Kotlin JNI boundary

Google Oboe is pulled in as `com.google.oboe:oboe:1.9.3` and linked through CMake Prefab.

### Verification status

- COMPILED: yes (`cd android-app && ./gradlew assembleDebug`)
- Backend tests: 25/25 passing when PostgreSQL is running
- TESTED ON EMULATOR: yes (AVD `RoxStar_API35`, Android 15 x86_64)
  - Create user against `http://10.0.2.2:3000`
  - Oboe record / stop produced a valid mono 16-bit 44.1 kHz WAV
  - Save / list / play draft; metadata synced to `POST /api/drafts`
  - Create room, see Rahul and Ahmed join, share draft, start spin
  - Eliminations every 5 seconds, winner Ahmed, socket disconnect/reconnect kept membership
- TESTED ON PHYSICAL DEVICE: yes (Xiaomi 22101316I / Redmi Note 12 Pro)
  - User `sai`, backend URL `http://10.7.9.169:3000` (same Wi‑Fi as the laptop)
  - Record / save / play drafts, join and create rooms, owner-only spin
  - Phone must stay on the laptop LAN; mobile data cannot reach `10.7.9.169`

## Docker and CI

Local full stack:

```bash
docker compose -f infrastructure/docker-compose.yml up -d --build
curl http://localhost:3000/health
```

If backend tests fail with `Can't reach database server at 127.0.0.1:5432`, PostgreSQL is not running. Start it with the compose command above, then `cd backend && npm test`.

CI is in `.github/workflows/ci.yml`: install, migrate, `npm test`, `npm run build`, Docker image build, and push to GitHub Container Registry on `main`.

Diagrams and edge cases:

- `docs/architecture.md`
- `docs/audio-flow.md`
- `docs/room-events.md`
- `docs/spin-state.md`
- `docs/edge-cases.md`
- `docs/deployment.md`

API docs remain at `http://localhost:3000/api/docs` while the backend is running.

Cloud hosting on AWS/GCP/Azure is still required for final submission. See `docs/deployment.md`.

