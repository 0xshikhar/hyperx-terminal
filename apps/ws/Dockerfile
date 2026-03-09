# Build stage
FROM node:22-alpine AS builder

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Copy package files
COPY package.json pnpm-workspace.yaml ./
COPY apps/ws/package.json ./apps/ws/
COPY packages/types/package.json ./packages/types/
COPY pnpm-lock.yaml ./

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY apps/ws ./apps/ws
COPY packages/types ./packages/types

# Build
RUN pnpm -C apps/ws build

# Production stage
FROM node:22-alpine AS production

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Copy package files
COPY package.json pnpm-workspace.yaml ./
COPY apps/ws/package.json ./apps/ws/
COPY packages/types/package.json ./packages/types/

# Install production dependencies only
RUN pnpm install --frozen-lockfile --prod

# Copy built files
COPY --from=builder /app/apps/ws/dist ./apps/ws/dist
COPY --from=builder /app/packages/types/dist ./packages/types/dist

EXPOSE 3002

CMD ["node", "apps/ws/dist/index.js"]
