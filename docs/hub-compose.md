# Token Monitor Hub — canonical Docker Compose deployment

This is the only supported Hub deployment. Pull the published Hub image from GitHub Container Registry and run it with MySQL.

## Requirements

- Docker Engine + Docker Compose v2
- Outbound access to `ghcr.io` and Docker Hub (`mysql`)

## Quick start

```bash
cp .env.example .env
# edit .env: TOKEN_MONITOR_SECRET, MYSQL_PASSWORD, MYSQL_ROOT_PASSWORD
# optional: TOKEN_MONITOR_VERSION=0.47.0  (default: latest)

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
| `0.47.0` | Pin a specific release (recommended for production) |
| `v0.47.0` | Same image, tag with `v` prefix |

Image: `ghcr.io/igngserver/token-monitor-hub`

## Upgrade

```bash
# follow latest
docker compose pull
docker compose up -d

# or pin
# TOKEN_MONITOR_VERSION=0.47.0 docker compose pull
# TOKEN_MONITOR_VERSION=0.47.0 docker compose up -d
```

Do **not** run `docker compose down -v` — that deletes the MySQL data volume.

## Gemini quota renewal

Google's OAuth token endpoint requires a client id **and** secret to redeem a
refresh token, so automatic renewal for a Gemini Code Assist account needs an
OAuth client of your own. This project deliberately ships neither — Google's own
client belongs to the `gemini-cli` project, and bundling it would make every
install authenticate as someone else's application.

Register a client (type **Desktop app**) in Google Cloud, then set both values in
`.env` and recreate the container:

```bash
GEMINI_OAUTH_CLIENT_ID=...apps.googleusercontent.com
GEMINI_OAUTH_CLIENT_SECRET=...
docker compose up -d
```

Set this on the **Hub**, not the desktop app: the probe runs server-side. A
pasted access token needs none of this (it is used as-is, and simply expires);
without the pair a refresh-token account reports *not configured* rather than
failing ambiguously.

## First GHCR pull note

If the package is private on a fresh org, set the package visibility to **Public** under
GitHub → Packages → `token-monitor-hub` → Package settings.
Public repos usually expose public packages after the first release push.
