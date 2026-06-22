# syntax=docker/dockerfile:1

# ── base ─────────────────────────────────────────────────────────────────────
# Node 20 (matches the dev toolchain) on Alpine. pnpm via corepack.
FROM node:20-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable
WORKDIR /app

# ── deps ─────────────────────────────────────────────────────────────────────
# Install dependencies in a cacheable layer (also the base for the dev compose).
FROM base AS deps
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# ── builder ──────────────────────────────────────────────────────────────────
# Generate the Prisma client and build the Next.js app.
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm prisma generate
RUN pnpm build

# ── runner ───────────────────────────────────────────────────────────────────
# Run the custom server (Next + Socket.IO) via tsx as a non-root user.
FROM base AS runner
ENV NODE_ENV=production
RUN addgroup -g 1001 -S nodejs && adduser -u 1001 -S mmmuzik -G nodejs
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/src ./src
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/tsconfig.json ./tsconfig.json
COPY --from=builder /app/next.config.ts ./next.config.ts
USER mmmuzik
EXPOSE 3000
# NOTE: the image does NOT auto-migrate (LESSONS L-9.1 / DATABASE §11).
# Migrations are an explicit deploy step; the dev compose runs them as a command.
CMD ["pnpm", "start"]
