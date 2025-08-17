# Multi-stage build for better security and smaller final image
FROM node:22-alpine AS deps
WORKDIR /app

# Install build dependencies
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    libc6-compat

# Copy package manifest first for better caching
COPY package.json ./

# Install dependencies without running postinstall scripts
RUN npm install --ignore-scripts --no-audit --no-fund --production=false

FROM node:22-alpine AS builder
WORKDIR /app

# Install build dependencies
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    libc6-compat

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy package manifest
COPY package.json ./

# Copy source
COPY . .

# Build TypeScript -> dist and prune dev deps for runtime
RUN npm run build && \
    npm prune --omit=dev && \
    npm audit --audit-level=moderate || true

FROM node:22-alpine AS runner
WORKDIR /app

# Install security updates and required packages
RUN apk update && \
    apk upgrade && \
    apk add --no-cache \
        wget \
        ca-certificates \
        tzdata \
        curl && \
    rm -rf /var/cache/apk/*

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 -G nodejs

# Create necessary directories with proper permissions
RUN mkdir -p /app/logs /app/temp && \
    chown -R nodejs:nodejs /app

# Copy production node_modules and built artifacts
COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist
COPY --from=builder --chown=nodejs:nodejs /app/package.json ./package.json

# Switch to non-root user
USER nodejs

# Set environment variables
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=8787

# Expose port
EXPOSE 8787

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8787/health || exit 1

# Start the application
CMD ["node", "dist/index.js"]

# Metadata
LABEL maintainer="Ever Life Vault Team"
LABEL description="Ever Life Vault Backend API Server"
LABEL version="latest"
LABEL org.opencontainers.image.source="https://github.com/raulshma/ever-life-vault"
LABEL org.opencontainers.image.description="Secure backend API server with authentication and integrations"
LABEL org.opencontainers.image.licenses="MIT"


