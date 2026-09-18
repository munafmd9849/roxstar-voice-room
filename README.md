# RoxStar Voice Room

Android voice drafts, realtime rooms, and a backend-owned spin wheel.

Audio stays on the phone (Oboe → echo → WAV). The Node backend is authoritative for rooms, draft metadata, and spin eliminations. PostgreSQL is the source of truth. Audio bytes are never uploaded.

| Area | Points | Status |
| --- | --- | --- |
| Android Audio Studio / Oboe | 40 | Done |
| Room + Realtime | 40 | Done |
| Spin Wheel | 50 | Done |
| Backend + Database | 30 | Done (25/25 tests) |
| Cloud + DevOps | 20 | Done — AWS EC2 + Caddy HTTPS |
| Documentation + Communication | 20 | Done (docs + demo video) |

## Live submission links

| Item | URL |
| --- | --- |
| **Hosted backend (HTTPS)** | https://roxstar.13.206.134.123.sslip.io |
| **Health** | https://roxstar.13.206.134.123.sslip.io/health |
| **API docs** | https://roxstar.13.206.134.123.sslip.io/api/docs |
| **Demo video** | https://drive.google.com/file/d/1_M4IV-OuXuxzam41I_ORqsxnqsh5760-/view?usp=sharing |
| **Release APK (v1.1)** | https://drive.google.com/file/d/1BYrEsqZBK6bi9Qc41J2I1YLe7_hXeg5n/view?usp=sharing |
| **Repository** | https://github.com/munafmd9849/roxstar-voice-room |

Production stack: AWS EC2 `t3.micro` (ap-south-1) → Caddy (Let’s Encrypt) → Node backend → Postgres (no public DB port). See `docs/deployment.md`.

Release APK ships with the cloud URL hardcoded. Override only via **⋮ → Settings → Server** for local debugging.

## Architecture

```
Android (Kotlin + JNI/Oboe)
  Record → Echo → WAV → local Room DB drafts
  REST + Socket.IO (metadata only)
        │
        ▼
Node.js + Express + Socket.IO + Prisma
        │
        ▼
PostgreSQL
```

Layout: `android-app/` · `android-app/app/src/main/cpp/` (Oboe) · `backend/` · `database/` · `infrastructure/` · `docs/`

## Local quick start

```bash
docker compose -f infrastructure/docker-compose.yml up -d --build
curl http://localhost:3000/health

cd backend && npm ci && npm test   # needs Postgres up
cd android-app && ./gradlew assembleDebug
```

| Client | Backend URL |
| --- | --- |
| Emulator | `http://10.0.2.2:3000` |
| Phone on same Wi‑Fi | `http://YOUR-LAN-IP:3000` |
| Production / release APK | `https://roxstar.13.206.134.123.sslip.io` |

Cleartext HTTP is for local development only.

### Backend without Docker (optional)

```bash
cd backend
npm install
export DATABASE_URL='postgresql://roxstar:roxstar_local_dev@localhost:5432/roxstar?schema=public'
npx prisma generate
npx prisma migrate deploy
npm run dev
```

## Android app

- **Record** with Google Oboe (C++), optional echo delay-line (~250 ms, decay 0.4)
- **WAV** mono 16-bit 44.1 kHz in app-private storage; Stop auto-saves draft
- **Drafts** list / play / delete locally; metadata synced to `POST /api/drafts`
- **Rooms** create / join / leave over REST; presence over Socket.IO
- **Share draft** sends metadata only (`draft_shared`), not audio bytes
- **Spin** owner-only start; backend eliminates one player every 5 seconds
- **Reconnect** re-sends `room:join` and replaces UI from `room_state`
- **Settings + logout**; Home does not show backend URL or user id

### Build

```bash
cd android-app
./gradlew assembleRelease   # share/APK uses this cloud build
./gradlew assembleDebug     # local / emulator
```

Native sources: `recorder.cpp`, `echo_processor.cpp`, `wav_writer.cpp`, `jni_bridge.cpp` under `android-app/app/src/main/cpp/`. Oboe `1.9.3` via Prefab.

### Tested on

- Emulator AVD `RoxStar_API35` (Android 15)
- Realme RMX5070, Infinix X6825, vivo 1814, Samsung SM-E146B, Xiaomi Redmi Note 12 Pro

## REST + Socket.IO (summary)

Authoritative room membership is REST. Socket.IO only adds presence after an active `RoomMember` exists. Disconnect ≠ leave.

| Method | Path |
| --- | --- |
| `POST` | `/api/users` |
| `POST` | `/api/rooms` |
| `POST` | `/api/rooms/:roomCode/join` |
| `POST` | `/api/rooms/:roomId/leave` |
| `GET` | `/api/rooms/:roomId` |
| `POST` | `/api/drafts` |
| `POST` | `/api/rooms/:roomId/spin/start` |
| `GET` | `/api/rooms/:roomId/spin` |

Socket client → server: `room:join`, `room:leave`, `room:state`  
Server → client: `room_state`, `user_joined`, `user_left`, `draft_shared`, `spin_started`, `user_eliminated`, `winner_announced`, `socket:error`

Spin lifecycle: `WAITING` → `RUNNING` → `COMPLETED` (or `ABORTED`). Eligible players: 3–20. Full detail in `docs/api.md`, `docs/room-events.md`, `docs/spin-state.md`.

## Cloud deploy

```bash
# On the EC2 host (after cloning / rsync)
cp infrastructure/env.cloud.example infrastructure/.env.cloud   # set secrets + PUBLIC_HOST
docker compose --env-file infrastructure/.env.cloud \
  -f infrastructure/docker-compose.cloud.yml up -d --build
curl https://roxstar.13.206.134.123.sslip.io/health
```

CI (`.github/workflows/ci.yml`): migrate + `npm test` + build, Docker image build, push to GHCR on `main`, optional SSH deploy when `DEPLOY_HOST` / `DEPLOY_USER` / `DEPLOY_SSH_KEY` secrets are set.

## Docs

- `docs/architecture.md` · `docs/audio-flow.md` · `docs/room-events.md` · `docs/spin-state.md`
- `docs/edge-cases.md` · `docs/deployment.md` · `docs/demo.md` · `docs/database.md` · `docs/api.md`

### Edge cases handled

Duplicate spin start (`409`); &lt;3 / &gt;20 players rejected; leave during spin → eliminated; reconnect restores `room_state`; socket disconnect keeps membership `ACTIVE`; duplicate draft share returns `duplicate: true`; owner-only start spin.
