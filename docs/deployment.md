# Deployment

## Local Docker

```bash
docker compose -f infrastructure/docker-compose.yml up -d --build
curl http://localhost:3000/health
```

Android emulator URL: `http://10.0.2.2:3000`  
Physical device URL: `http://YOUR-LAN-IP:3000`

Secrets: copy `backend/.env.example` to `backend/.env`. Do not commit `.env`.

## CI

GitHub Actions (`.github/workflows/ci.yml`) installs backend dependencies, migrates PostgreSQL, runs `npm test`, builds TypeScript, and builds the Docker image.

## Cloud (required for submission)

Local Docker is not the final submission. Deploy the same image to AWS, GCP, or Azure with:

- `DATABASE_URL`
- `PORT`
- HTTPS in front of the Node service
- `GET /health` as the readiness check

Rollback: keep the previous image tag and redeploy it if `/health` fails or tests fail on main.

A public cloud URL is still outstanding until AWS/GCP/Azure credentials are available.
