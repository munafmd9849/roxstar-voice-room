# Deployment

## Local Docker

```bash
docker compose -f infrastructure/docker-compose.yml up -d --build
curl http://localhost:3000/health
```

Android emulator URL: `http://10.0.2.2:3000`  
Physical device URL: `http://YOUR-LAN-IP:3000`

Secrets: copy `backend/.env.example` to `backend/.env`. Do not commit `.env`.

## CI/CD

GitHub Actions (`.github/workflows/ci.yml`) on `main`:

1. Install backend dependencies, migrate PostgreSQL, `npm test`, `npm run build`
2. Build the Docker image
3. Push `ghcr.io/<owner>/roxstar-voice-room/backend:<sha>` (and `:latest`)

Cloud deploy pulls that image. There is no in-repo AWS/GCP/Azure account, so the public HTTPS URL is still created by hand (below).

## Cloud (required for submission)

Local Docker is not the final submission. Deploy the same image to AWS, GCP, or Azure with:

- `DATABASE_URL`
- `PORT`
- HTTPS in front of the Node service
- `GET /health` as the readiness check

### Fastest path: Google Cloud Run + Cloud SQL

```bash
gcloud auth login
gcloud config set project YOUR_PROJECT
gcloud run deploy roxstar-backend \
  --image ghcr.io/YOUR_GITHUB_USER/roxstar-voice-room/backend:latest \
  --region asia-south1 \
  --allow-unauthenticated \
  --set-env-vars DATABASE_URL='postgresql://USER:PASS@HOST:5432/roxstar?schema=public' \
  --port 3000
```

Use Cloud SQL for PostgreSQL, or any managed Postgres, then put the Cloud Run HTTPS URL into the Android **Backend URL** field.

### AWS App Runner + RDS

Create an RDS Postgres instance, then App Runner from the GHCR image with `DATABASE_URL` and `PORT=3000`. Health check path: `/health`.

### Azure Container Apps + Azure Database for PostgreSQL

Same image, same env vars, HTTPS ingress, health path `/health`.

Rollback: redeploy the previous image tag if `/health` fails or tests fail on main.

A public cloud URL is still outstanding until AWS/GCP/Azure credentials are available.
