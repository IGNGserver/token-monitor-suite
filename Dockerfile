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
COPY assets/icon.png ./assets/icon.png
COPY docker-entrypoint.sh /usr/local/bin/token-monitor-hub

RUN chmod +x /usr/local/bin/token-monitor-hub

EXPOSE 17321
ENTRYPOINT ["/usr/local/bin/token-monitor-hub"]

