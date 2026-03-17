# Build stage
FROM node:22-alpine AS builder

WORKDIR /app

RUN npm install -g pnpm

COPY package.json pnpm-workspace.yaml ./
COPY apps/ws/package.json ./apps/ws/
COPY packages/types/package.json ./packages/types/
COPY pnpm-lock.yaml ./

RUN pnpm install --frozen-lockfile

COPY apps/ws ./apps/ws
COPY packages/types ./packages/types

RUN pnpm -C packages/types build
RUN pnpm -C apps/ws build

FROM node:22-alpine AS production

WORKDIR /app

RUN npm install -g pnpm

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/ws/package.json ./apps/ws/
COPY packages/types/package.json ./packages/types/

RUN pnpm install --frozen-lockfile --prod

COPY --from=builder /app/apps/ws/dist ./apps/ws/dist
COPY --from=builder /app/packages/types/dist ./packages/types/dist

EXPOSE 3002

CMD ["node", "apps/ws/dist/index.js"]
