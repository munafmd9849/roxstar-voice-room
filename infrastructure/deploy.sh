#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
COMPOSE_FILE="$ROOT/infrastructure/docker-compose.cloud.yml"
ENV_FILE="$ROOT/infrastructure/.env.cloud"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing $ENV_FILE — copy infrastructure/env.cloud.example and fill it in."
  exit 1
fi

# shellcheck disable=SC1090
set -a
source "$ENV_FILE"
set +a

cd "$ROOT"
git fetch origin main
git reset --hard origin/main

if [[ -n "${GHCR_TOKEN:-}" ]]; then
  echo "$GHCR_TOKEN" | docker login ghcr.io -u "${GHCR_USER:-munafmd9849}" --password-stdin
fi

docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" pull backend
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" up -d

sleep 5
curl -fsS "https://${PUBLIC_HOST}/health"
echo
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" ps
