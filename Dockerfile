FROM node:24.19.0-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN --mount=type=secret,id=build_ca,target=/tmp/entre-build-ca.pem \
    if [ -f /tmp/entre-build-ca.pem ]; then export NODE_EXTRA_CA_CERTS=/tmp/entre-build-ca.pem; fi; \
    npm ci --no-audit --no-fund
COPY . .
RUN npm run build:pilot && npm prune --omit=dev --no-audit --no-fund

FROM node:24.19.0-alpine
ENV NODE_ENV=production PORT=8788 ENTRE_BIND=0.0.0.0 ENTRE_DATABASE_PATH=/data/entre.sqlite
WORKDIR /app
RUN mkdir /data && chown node:node /data
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/package.json ./package.json
COPY --from=build --chown=node:node /app/server ./server
COPY --from=build --chown=node:node /app/src/data.ts ./src/data.ts
COPY --from=build --chown=node:node /app/src/room/engine.ts ./src/room/engine.ts
COPY --from=build --chown=node:node /app/src/chat/sticker-packs.json ./src/chat/sticker-packs.json
COPY --from=build --chown=node:node /app/scripts/backup-db.mjs ./scripts/backup-db.mjs
COPY --from=build --chown=node:node /app/dist-pilot ./dist-pilot
USER node
EXPOSE 8788
VOLUME ["/data"]
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s CMD node -e "fetch('http://127.0.0.1:8788/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server/pilot.ts"]
