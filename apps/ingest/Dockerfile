# Build stage
FROM node:22-alpine AS builder

WORKDIR /app

RUN npm install -g pnpm

COPY package.json pnpm-workspace.yaml ./
COPY apps/ingest/package.json ./apps/ingest/
COPY packages/types/package.json ./packages/types/
COPY pnpm-lock.yaml ./

RUN pnpm install --frozen-lockfile

COPY apps/ingest ./apps/ingest
COPY packages/types ./packages/types

RUN pnpm -C packages/types build
RUN pnpm -C apps/ingest build

# Production stage
FROM node:22-alpine AS production

WORKDIR /app

RUN npm install -g pnpm

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/ingest/package.json ./apps/ingest/
COPY packages/types/package.json ./packages/types/

RUN pnpm install --frozen-lockfile --prod

COPY --from=builder /app/apps/ingest/dist ./apps/ingest/dist
COPY --from=builder /app/packages/types/dist ./packages/types/dist

CMD ["node", "apps/ingest/dist/index.js"]
