FROM node:22.13.1-bookworm-slim AS dependencies

WORKDIR /app
COPY package.json package-lock.json ./
COPY scripts/prune-hub-deps.js ./scripts/prune-hub-deps.js
RUN npm ci --omit=dev && node scripts/prune-hub-deps.js && npm cache clean --force

FROM node:22.13.1-bookworm-slim AS runtime

WORKDIR /app
ENV NODE_ENV=production

COPY --from=dependencies /app/node_modules ./node_modules
COPY package.json ./
COPY migrations ./migrations
COPY src/hub ./src/hub
COPY src/shared ./src/shared
# The dashboard's UI lives in the shared package: src/hub/static.js serves it
# under /ui/ and resolves /icons/clients/* from its icon tree. Without this the
# Hub boots and the API works, but every page asset 404s.
COPY src/shared-ui ./src/shared-ui
COPY assets/icon.png ./assets/icon.png
COPY docker-entrypoint.sh /usr/local/bin/token-monitor-hub

RUN chmod +x /usr/local/bin/token-monitor-hub

EXPOSE 17321
ENTRYPOINT ["/usr/local/bin/token-monitor-hub"]

