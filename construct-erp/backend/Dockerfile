# backend/Dockerfile
FROM node:20-alpine AS base
WORKDIR /app
# curl — healthcheck probe
# postgresql-client — pg_dump for automated backups
RUN apk add --no-cache curl postgresql-client

# Install dependencies
FROM base AS deps
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# Production image
FROM base AS runner
ENV NODE_ENV=production

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN mkdir -p uploads logs

EXPOSE 5000
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s \
  CMD curl -f http://localhost:5000/health || exit 1

CMD ["node", "src/server.js"]
