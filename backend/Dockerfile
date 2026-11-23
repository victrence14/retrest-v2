FROM node:22-bookworm-slim AS build
WORKDIR /app/backend
COPY backend/package.json backend/package-lock.json ./
RUN npm ci
COPY tsconfig.base.json /app/tsconfig.base.json
COPY shared /app/shared
COPY backend/tsconfig.json ./
COPY backend/src ./src
COPY backend/db ./db
RUN npm run build

FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production RETREST_DEMO_ENABLED=false PORT=3001
WORKDIR /app/backend
COPY backend/package.json backend/package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build --chown=node:node /app/tsconfig.base.json /app/tsconfig.base.json
COPY --from=build --chown=node:node /app/shared /app/shared
COPY --from=build --chown=node:node /app/backend/src ./src
COPY --from=build --chown=node:node /app/backend/db ./db
COPY --from=build --chown=node:node /app/backend/tsconfig.json ./
RUN mkdir -p /app/backend/data && chown node:node /app/backend/data
USER node
EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=12s --start-period=15s --retries=3 CMD node -e "fetch('http://127.0.0.1:3001/api/ready').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["npm", "start"]
