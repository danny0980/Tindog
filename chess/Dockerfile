# Chronos Chess: the game server and the built app in one image.
#
#   docker build -t chronos-chess .
#   docker run -p 8787:8787 -v chess-data:/data --env-file server/.env chronos-chess
#
# Everything players create lives in the /data volume (SQLite + backups).

FROM node:22-bookworm-slim AS build
WORKDIR /app
# The install step copies the Stockfish engine out of node_modules (scripts/copy-stockfish.mjs).
COPY package.json package-lock.json ./
COPY scripts ./scripts
RUN npm ci
COPY . .
RUN npm run build:all && npm prune --omit=dev

FROM node:22-bookworm-slim
ENV NODE_ENV=production \
    PORT=8787 \
    DATABASE_FILE=/data/chess.db
WORKDIR /app
COPY --from=build /app/package.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/dist-server ./dist-server
RUN mkdir -p /data && chown node:node /data
USER node
VOLUME /data
EXPOSE 8787
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s \
  CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/api/health').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"
CMD ["node", "dist-server/index.mjs"]
