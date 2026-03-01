# ---------- Dependencies ----------
FROM node:20-bookworm-slim AS deps
WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# Keep install layer cache-friendly
COPY package.json package-lock.json* ./
COPY prisma ./prisma
RUN npm ci --include=optional --no-audit --no-fund

# ---------- Builder ----------
FROM node:20-bookworm-slim AS builder
WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Re-generate Prisma clients inside Linux build env before Next build,
# so standalone trace includes correct query engines.
RUN npx prisma generate
RUN npm run build

# ---------- Runner ----------
FROM node:20-bookworm-slim AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# Run app with non-root user
RUN groupadd --system nodejs \
  && useradd --system --gid nodejs nextjs

# Standalone output
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma

USER nextjs

EXPOSE 3000
CMD ["node", "server.js"]