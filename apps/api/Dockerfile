# Build stage
FROM node:22-alpine AS builder

WORKDIR /app

RUN npm install -g pnpm

COPY package.json pnpm-workspace.yaml ./
COPY apps/api/package.json ./apps/api/
COPY packages/types/package.json ./packages/types/
COPY pnpm-lock.yaml ./

RUN pnpm install --frozen-lockfile

COPY apps/api ./apps/api
COPY packages/types ./packages/types

RUN pnpm -C packages/types build
RUN pnpm -C apps/api build

FROM node:22-alpine AS production

WORKDIR /app

COPY --from=builder /app /app

EXPOSE 3001

CMD ["node", "apps/api/dist/index.js"]
