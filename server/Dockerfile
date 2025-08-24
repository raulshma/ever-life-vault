FROM node:22-alpine AS builder
WORKDIR /app

# Install build deps
RUN apk add --no-cache python3 make g++

# Copy package manifest first for better caching
COPY package.json ./

# Install dependencies without running postinstall scripts
RUN npm install --ignore-scripts --no-audit --no-fund

# Copy source
COPY . .

# Build TypeScript -> dist and prune dev deps for runtime
ENV NODE_OPTIONS="--max-old-space-size=4096"
RUN npm run build && npm prune --omit=dev

FROM node:22-alpine AS runner
WORKDIR /app

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Copy production node_modules and built artifacts
COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist

# Install wget for health checks
RUN apk add --no-cache wget

# Switch to non-root user
USER nodejs

ENV NODE_ENV=production
EXPOSE 8787

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8787/health || exit 1

CMD ["node", "dist/index.js"]


