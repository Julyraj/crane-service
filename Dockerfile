# syntax=docker/dockerfile:1
FROM node:22-bookworm-slim AS build
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY server/package.json server/
COPY ui/package.json ui/
RUN pnpm install --frozen-lockfile
COPY packages packages
COPY server server
COPY ui ui
RUN pnpm build && pnpm --filter @crane/server deploy --prod --legacy /out

FROM node:22-bookworm-slim
ENV NODE_ENV=production PORT=4100 DATA_DIR=/data UI_DIST=/app/ui
WORKDIR /app
COPY --from=build /out/node_modules ./node_modules
COPY --from=build /app/server/dist ./dist
COPY --from=build /app/ui/dist ./ui
RUN mkdir -p /data && chown node:node /data
USER node
VOLUME /data
EXPOSE 4100
HEALTHCHECK --interval=30s --timeout=3s CMD node -e "fetch('http://127.0.0.1:4100/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "--disable-warning=ExperimentalWarning", "dist/index.js"]
