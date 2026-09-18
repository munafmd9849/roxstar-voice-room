# RoxStar Voice Room — full progress briefing (day 0 → now)

Copy this entire file into ChatGPT as project context. It is the source of truth for what already exists. Do **not** redesign the backend. Do **not** add WebRTC, LiveKit, AI, Kubernetes, Redis, Kafka, JWT, or audio upload.

**Date:** 17 September 2026  
**Repo:** https://github.com/munafmd9849/roxstar-voice-room  
**Branch:** `main`  
**Last pushed commit:** `32bfd0f` — Polish Android UI and document remaining submission steps  
**Working tree after that:** extra uncommitted Android polish (logout, Settings, hide backend URL from Home, copy room code, shared-drafts list, delete confirm). APK was rebuilt locally.

---

## 1. What we are building

Assessment: **RoxStar Voice Draft, Real-Time Room and Spin Wheel System** (200 points).

| Area | Points | Status |
| --- | --- | --- |
| Android Audio Studio / Oboe | 40 | Done and tested (emulator + Xiaomi) |
| Room + Realtime | 40 | Done and tested |
| Spin Wheel | 50 | Done and tested |
| Backend + Database | 30 | Done (25/25 tests) |
| Cloud + DevOps | 20 | Docker + GitHub Actions done; **no public HTTPS URL yet** |
| Documentation + Communication | 20 | Done (docs + demo script) |

### Product flow

```
User → Android app → Record locally with Oboe → Echo → Save Draft locally
  → Create / Join Room → Share Draft metadata (not audio bytes)
  → Multiple users in room → Owner starts Spin
  → Backend eliminates one user every 5 seconds → One winner
```

### Explicitly out of scope (do not build)

Live voice streaming, WebRTC, LiveKit, AI audio, Kubernetes, Kafka, Redis, microservices, authentication/JWT/OAuth, cloud audio storage, audio upload, payments, real-money points, complex animations, multi-tenant architecture.

---

## 2. Architecture (implemented)

```
ANDROID APP (Kotlin)
  Home, Recorder, Drafts, Room, Spin, Settings
  Retrofit REST + Socket.IO Java client
  Room DB + app-private WAV files
        │
        │  JNI
        ▼
  C++ / Oboe (inside android-app/app/src/main/cpp/)
  Microphone → Oboe → Echo delay-line → WAV writer
        │
        │  REST + Socket.IO  (no audio bytes)
        ▼
NODE.JS + EXPRESS + SOCKET.IO  (authoritative)
        │
        ▼
POSTGRESQL via Prisma
```

**Hard rule:** backend is the source of truth for membership, shared draft metadata, and spin. Android must not run a second 5-second spin timer. Socket disconnect ≠ leave room.

---

## 3. Repository layout

```
roxstar-voice-room/
├── android-app/          # full Kotlin + JNI/Oboe Android app
├── native-audio/         # README pointing at android-app cpp (sources live with the app)
├── backend/              # Node 22, TypeScript, Express, Prisma, Socket.IO, Vitest
├── database/             # README → backend/prisma
├── infrastructure/       # docker-compose.yml (postgres + backend)
├── docs/                 # architecture, audio, rooms, spin, edge cases, deploy, demo, API
├── .github/workflows/ci.yml
└── README.md
```

Native audio is **not** a separate compiled project. It is:

- `android-app/app/src/main/cpp/recorder.cpp`
- `echo_processor.cpp`
- `wav_writer.cpp`
- `jni_bridge.cpp`

---

## 4. Timeline of what was implemented

### Phase 0 — empty repo

Initial commit only.

### Phase 1 — Backend foundation  ✅  (`d1ed2eb`)

- Node.js 22, TypeScript, Express 5
- dotenv, CORS, Helmet, Morgan
- `GET /health` → `{ "status": "ok", "service": "roxstar-backend" }`
- Structure: `src/app.ts`, `src/server.ts`, tests, `package.json`

### Phase 2 — PostgreSQL + Prisma  ✅  (`0bd589b`)

Entities:

- User
- Room
- RoomMember (status `ACTIVE` | `LEFT`; rows are **not** deleted on leave)
- Draft (metadata only; no audio bytes in DB)
- SharedDraft
- Spin (`WAITING` | `RUNNING` | `COMPLETED` | `ABORTED`)
- SpinParticipant (`ACTIVE` | `ELIMINATED` | `WINNER`)
- SpinEvent (`SPIN_STARTED` | `USER_ELIMINATED` | `WINNER_ANNOUNCED` | `SPIN_ABORTED`) with sequence numbers

Local DB: user/db `roxstar`, password `roxstar_local_dev`, port 5432.  
Connection string in `backend/.env.example`. Never commit `backend/.env`.

### Phase 3 — User + Room REST  ✅  (`625059f`)

| Method | Path | Notes |
| --- | --- | --- |
| POST | `/api/users` | `{ name }` → 201 `{ id, name, createdAt }`. No auth. |
| POST | `/api/rooms` | `{ userId }` → 201 room + 6-char uppercase `code`, owner membership |
| POST | `/api/rooms/:code/join` | join or reactivate LEFT membership; no duplicate rows |
| POST | `/api/rooms/:id/leave` | marks `LEFT`; history kept |
| GET | `/api/rooms/:id` | authoritative room + participants |

`RoomMember.isConnected` stays false for HTTP. REST membership ≠ Socket presence.

OpenAPI/Swagger added (`97d5512`). UI: `http://localhost:3000/api/docs`.

### Phase 4 — Socket.IO presence  ✅  (same era as rooms)

Socket.IO on the **same HTTP server/port** as Express.

Client → server: `room:join`, `room:leave`, `room:state`  
Server → client: `room_state`, `user_joined`, `user_left`, `socket:error`

A socket cannot create/delete membership. Presence only after REST membership is ACTIVE. Multiple sockets per user: `isConnected` true until last socket leaves. Disconnect never sets membership to LEFT. Reconnect = send `room:join` again.

### Phase 5 — Spin engine  ✅  (`a499648`)

| Method | Path |
| --- | --- |
| POST | `/api/rooms/:roomId/spin/start`  body `{ userId }` — **owner only** |
| GET | `/api/rooms/:roomId/spin` |

Rules implemented:

- Room must be ACTIVE; owner must be an active member
- Exactly **3–20** active members (more than 20 is rejected, not silently truncated)
- One active spin (`WAITING` or `RUNNING`) per room
- Lifecycle: WAITING → RUNNING → COMPLETED, or RUNNING → ABORTED
- Backend timer eliminates **one participant every 5 seconds**
- Last remaining eligible participant is the winner
- Events persisted **before** broadcast, with deterministic sequences
- Socket events: `spin_started`, `user_eliminated`, `winner_announced`
- `room_state` includes latest spin so reconnect recovers
- Member REST-leave during a running spin → that participant eliminated immediately; spin continues
- Duplicate start → `409 SPIN_ALREADY_RUNNING`

Android must **not** implement a second timer.

### Phase 6 — Draft backend  ✅  (`c1b577e`)

| Method | Path |
| --- | --- |
| POST | `/api/drafts` |
| GET | `/api/drafts?userId=` |
| GET | `/api/drafts/:draftId` |
| DELETE | `/api/drafts/:draftId` |
| POST | `/api/rooms/:roomId/drafts/share` |

Realtime: `draft_shared` (metadata only). Duplicate share returns `duplicate: true` and does not rebroadcast.

**Audio bytes are never uploaded and never sent over Socket.IO.**

### Phase 7 — Backend verification  ✅

- 25 / 25 Vitest tests passing when Postgres is running
- Spin, room, socket, draft tests exist under `backend/tests/`
- `npm test` + `npm run build`
- If tests fail with Prisma P1001, start compose Postgres first

### Phase 8 — Android application  ✅  (`0a84539` then UI polish)

Stack: Kotlin, AGP 8.8.2, Gradle 8.10.2, Kotlin 2.1.10, compileSdk 35, NDK 27.2.12479018, CMake 3.30.5, Oboe 1.9.3 Prefab.

Package: `com.roxstar.voice`  
Build: `cd android-app && ./gradlew assembleDebug`  
APK: `android-app/app/build/outputs/apk/debug/app-debug.apk`

#### Native audio

- Oboe input stream, start / stop / cancel
- States: IDLE, RECORDING, STOPPING, SAVED, CANCELLED, ERROR (UI labels: Ready / Recording / Saving / Saved / Cancelled / Error)
- Echo: delay-line, ~250 ms, decay 0.4, toggle Echo ON/OFF
- WAV: mono, 16-bit PCM, 44.1 kHz, correct RIFF/WAVE/fmt/data headers
- Mic permission: grant, deny, permanently denied → settings
- Lifecycle: no double-start/stop, cancel discards, leave-screen cleanup, JNI resource release

#### Local drafts

- Android Room DB: id, name, filePath, durationMs, createdAt, echoEnabled, backendId
- WAV in app-private storage
- Save / list / play (MediaPlayer) / delete (row + file)
- After save, metadata also POSTed to `/api/drafts` if backend is up; local save still works if backend is down

#### Screens

- Name setup (first launch): display name → `POST /api/users` → store `userId` + `userName`. Server URL hidden behind “Use a different server”
- Home: Hello {name}, room hint, Record / My drafts / Room & spin. **No URL, no user id.** Overflow ⋮ = Settings + Log out
- Recorder, Drafts, Room, Spin, Settings
- Log out: disconnect socket, REST-leave if in a room, clear user/room prefs, **keep API URL**, go back to name setup. Local WAV drafts stay on device.

#### Networking

- Retrofit/OkHttp for all REST listed above
- Socket.IO client: emit join/leave/state; listen user_joined, user_left, room_state, draft_shared, spin_started, user_eliminated, winner_announced
- Connection chip: Connected / Disconnected / Reconnecting
- Demo buttons: Disconnect / Reconnect (membership kept)
- Configurable base URL: `BuildConfig.API_BASE_URL` default `http://10.0.2.2:3000`; override in Settings
- Cleartext HTTP allowed for local/LAN only (`network_security_config.xml`)
- Emulator: `http://10.0.2.2:3000`
- Physical phone on same Wi‑Fi: `http://10.7.9.169:3000` (this Ubuntu LAN IP; do not use mobile data)

Room UI: create/join/leave, participants, share draft picker, copy room code, shared-drafts list, live events, open spin. Spin UI: owner-only Start spin (hidden for non-owners), remaining ✓/✗, last eliminated, winner. Backend owns timing.

### Phase 9 — Docker + CI  ✅  (in `32bfd0f`)

`infrastructure/docker-compose.yml`:

- `roxstar-postgres` Postgres 16 alpine, port 5432
- `roxstar-backend` builds `backend/Dockerfile`, port 3000, `prisma migrate deploy` then `node dist/server.js`
- Healthcheck hits `/health`

`.github/workflows/ci.yml` on push/PR:

1. Node 22 + service Postgres → migrate → `npm test` → `npm run build`
2. Docker image build
3. On push to `main`: push `ghcr.io/<owner>/roxstar-voice-room/backend:<sha>` and `:latest`

### Phase 10 — Docs  ✅

- `docs/architecture.md`
- `docs/audio-flow.md`
- `docs/room-events.md`
- `docs/spin-state.md`
- `docs/edge-cases.md`
- `docs/deployment.md`
- `docs/database.md`
- `docs/api/README.md`
- `docs/demo.md` (spoken 5–10 min script)
- `docs/progress.md` (this file)
- `database/README.md`, `native-audio/README.md`

---

## 5. Git history (oldest → newest)

1. `cf69d49` Initial commit  
2. `d1ed2eb` initialize backend  
3. `0bd589b` add postgres and prisma schema  
4. `625059f` feat: add user and room APIs  
5. `97d5512` added swagger  
6. `a499648` feat: add spin engine and lifecycle  
7. `c1b577e` feat: add draft management and sharing  
8. `0a84539` added android  
9. `32bfd0f` Polish Android UI and document remaining submission steps  

Uncommitted after 9: Settings/logout/hide URL and related layouts (already compiled into a local debug APK).

---

## 6. What was actually tested (not claimed)

### Backend

- 25/25 tests with Docker Postgres up
- Health: `GET http://localhost:3000/health`

### Emulator (AVD `RoxStar_API35`, Android 15 x86_64, Pixel 6)

- User **mun**, id `cmu54daii000001rtkh35rw8a`
- URL `http://10.0.2.2:3000`
- Valid mono 16-bit 44.1 kHz WAV from Oboe
- Save / list / play draft; metadata `POST /api/drafts`
- Created room **9SXUUH**; Rahul and Ahmed joined
- Share draft, spin, eliminations every 5s, winner **Ahmed**
- Socket disconnect/reconnect kept membership

### Physical phone (Xiaomi 22101316I / Redmi Note 12 Pro, serial `sgu4mv6xbiivjz79`)

- First install needed **Install via USB** + **USB debugging (Security settings)**
- User **sai**, id `cmu54tvwo000h01rtajuycksx`
- URL `http://10.7.9.169:3000` — **must be same Wi‑Fi as laptop**; Jio mobile data cannot reach that IP
- Joined 9SXUUH (could not start spin — not owner)
- Created owner room **QEMXM6**, spin ran, winner **Rahul**
- Latest Home (after hide-URL change, verified on emulator): Hello {name}, room hint, three buttons only. Phone reinstall of that APK was pending if USB not plugged in.

Known Xiaomi quirks: `INSTALL_FAILED_USER_RESTRICTED` until USB install enabled; `adb` sometimes needs `adb kill-server` after plug-in; USB mode MTP+ADB (`2717:ff48`).

---

## 7. Important product rules (do not regress)

1. Do not modify backend APIs or Prisma schema unless Android cannot integrate otherwise. Do not break `npm test`.
2. Do not upload audio. Draft share is metadata.
3. Do not start spin from a non-owner client. UI hides Start spin for non-owners.
4. Need 3–20 players. Phone must **Create room** to be owner.
5. Socket disconnect must not call leave-room.
6. Backend URL is developer Settings, not Home.
7. Log out is “switch account”, not real auth. Keep API URL. Do not add JWT.
8. Docker/AWS public hosting waits until the demo recording is done, per current plan.

---

## 8. How to run locally

```bash
docker compose -f infrastructure/docker-compose.yml up -d --build
curl http://localhost:3000/health
cd backend && npm test
cd android-app && ./gradlew assembleDebug
```

Without Docker, Postgres still via compose, then `cd backend && npm run dev`.

Android:

- Emulator API URL `http://10.0.2.2:3000`
- Phone API URL `http://<laptop-LAN-IP>:3000` in ⋮ Settings

---

## 9. What is left (only these)

1. **Reinstall latest APK on the Xiaomi** if it still shows Backend URL on Home (uncommitted Settings/logout build).
2. **Record the 5–10 minute demo** using `docs/demo.md`. Phone = owner **sai**, emulator = **mun**, third client required, owner starts spin, then disconnect/reconnect.
3. **Cloud host** after the app demo: AWS / GCP / Azure, HTTPS, `DATABASE_URL`, `GET /health`. Same Docker image. No cloud credentials on this machine yet. See `docs/deployment.md`.
4. Optional: commit/push the uncommitted Settings/logout UI.

Not left: Oboe, echo, WAV, drafts, REST, Socket.IO, rooms, spin, reconnect, Docker, CI, architecture docs.

---

## 10. Constraints for the next assistant

- You are continuing an almost-finished assessment, not a greenfield app.
- Prefer small UI/demo fixes over new features.
- Do not commit or push unless the user asks.
- Do not start AWS until the user says the app is demo-ready (they already said Docker/AWS wait).
- Laptop LAN IP used in testing: `10.7.9.169`.
- If asked to “implement everything left”, that means demo recording help + later cloud, not rewriting Android or backend.
