# Token Monitor Hub — canonical Docker Compose deployment

This is the only supported Hub deployment. Pull the published Hub image from GitHub Container Registry and run it with MySQL.

## Requirements

- Docker Engine + Docker Compose v2
- Outbound access to `ghcr.io` and Docker Hub (`mysql`)

## Quick start

```bash
cp .env.example .env
# edit .env: TOKEN_MONITOR_SECRET, MYSQL_PASSWORD, MYSQL_ROOT_PASSWORD
# optional: TOKEN_MONITOR_VERSION=0.34.2  (default: latest)

docker compose pull
docker compose up -d
docker compose ps
curl http://127.0.0.1:17321/api/health
```

Open `http://<server>:17321` for the web dashboard (same port as the API).

## Versions

| Value | Meaning |
|---|---|
| `latest` (default) | Newest formal release image |
| `0.34.2` | Pin a specific release (recommended for production) |
| `v0.34.2` | Same image, tag with `v` prefix |

Image: `ghcr.io/igngserver/token-monitor-hub`

## Upgrade

```bash
# follow latest
docker compose pull
docker compose up -d

# or pin
# TOKEN_MONITOR_VERSION=0.34.2 docker compose pull
# TOKEN_MONITOR_VERSION=0.34.2 docker compose up -d
```

Do **not** run `docker compose down -v` — that deletes the MySQL data volume.

## First GHCR pull note

If the package is private on a fresh org, set the package visibility to **Public** under
GitHub → Packages → `token-monitor-hub` → Package settings.
Public repos usually expose public packages after the first release push.
