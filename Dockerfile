# Multi-stage build for better security and smaller final image
FROM node:22-alpine AS deps
WORKDIR /app

# Install build dependencies
RUN apk add --no-cache libc6-compat

# Enable corepack to use pnpm
ENV COREPACK_ENABLE_STRICT=0
RUN corepack enable

# Copy package files for dependency installation
COPY package.json pnpm-lock.yaml ./

# Install dependencies with security best practices
RUN pnpm install --frozen-lockfile --prod=false && \
    pnpm store prune

FROM node:22-alpine AS builder
WORKDIR /app

# Enable corepack to use pnpm
ENV COREPACK_ENABLE_STRICT=0
RUN corepack enable

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /root/.local/share/pnpm/store /root/.local/share/pnpm/store

# Optional Turnstile site key for Vite build-time injection
ARG VITE_TURNSTILE_SITE_KEY=
ENV VITE_TURNSTILE_SITE_KEY=${VITE_TURNSTILE_SITE_KEY}

# Copy source files
COPY package.json pnpm-lock.yaml ./
COPY tsconfig.json tsconfig.app.json tsconfig.node.json ./
COPY vite.config.ts ./
COPY postcss.config.js tailwind.config.ts ./
COPY index.html ./
COPY public ./public
COPY src ./src

# Build the application
RUN pnpm build

# Production stage with nginx
FROM nginx:alpine AS runner

# Install security updates and required packages
RUN apk update && \
    apk upgrade && \
    apk add --no-cache \
        wget \
        openssl \
        ca-certificates \
        tzdata \
        curl && \
    rm -rf /var/cache/apk/*

# Create non-root user for security
RUN addgroup -g 1001 -S nginx-user && \
    adduser -S nginx-user -u 1001 -G nginx-user

# Create SSL directory and generate self-signed certificate with better configuration
RUN mkdir -p /etc/nginx/ssl && \
    openssl req -x509 -nodes -days 365 -newkey rsa:4096 \
    -keyout /etc/nginx/ssl/key.pem \
    -out /etc/nginx/ssl/cert.pem \
    -subj "/C=US/ST=State/L=City/O=Organization/OU=IT/CN=localhost" \
    -addext "subjectAltName=DNS:localhost,DNS:*.localhost,IP:127.0.0.1,IP:0.0.0.0" \
    -addext "extendedKeyUsage=serverAuth" \
    -addext "keyUsage=digitalSignature,keyEncipherment" && \
    chmod 600 /etc/nginx/ssl/key.pem && \
    chmod 644 /etc/nginx/ssl/cert.pem

# Copy nginx configuration and build output
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html

# Set proper permissions for security
RUN chown -R nginx-user:nginx-user /usr/share/nginx/html && \
    chown -R nginx-user:nginx-user /var/cache/nginx && \
    chown -R nginx-user:nginx-user /var/log/nginx && \
    chown -R nginx-user:nginx-user /etc/nginx/conf.d && \
    chown -R nginx-user:nginx-user /etc/nginx/ssl && \
    chown -R nginx-user:nginx-user /var/run && \
    chmod -R 755 /usr/share/nginx/html && \
    chmod 644 /etc/nginx/conf.d/default.conf

# Create health check file
RUN echo "healthy" > /usr/share/nginx/html/health && \
    chown nginx-user:nginx-user /usr/share/nginx/html/health

# Switch to non-root user for security
USER nginx-user

# Expose ports
EXPOSE 80 443

# Health check - use HTTPS to verify SSL is working
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider --no-check-certificate https://localhost:443/health || exit 1

# Start nginx
CMD ["nginx", "-g", "daemon off;"]

# Metadata
LABEL maintainer="Ever Life Vault Team"
LABEL description="Ever Life Vault Web Application with SSL Support"
LABEL version="latest"
LABEL org.opencontainers.image.source="https://github.com/raulshma/ever-life-vault"
LABEL org.opencontainers.image.description="Secure web application with SSL and bot protection"
LABEL org.opencontainers.image.licenses="MIT"




