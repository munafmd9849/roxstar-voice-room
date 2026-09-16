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
