FROM node:22-alpine AS builder
WORKDIR /app

# Enable corepack to use pnpm
ENV COREPACK_ENABLE_STRICT=0
RUN corepack enable

# Optional Turnstile site key for Vite build-time injection
ARG VITE_TURNSTILE_SITE_KEY=
ENV VITE_TURNSTILE_SITE_KEY=${VITE_TURNSTILE_SITE_KEY}

# Copy only files needed for install first (better layer caching)
COPY package.json pnpm-lock.yaml ./
COPY tsconfig.json tsconfig.app.json tsconfig.node.json ./
COPY vite.config.ts ./
COPY postcss.config.js tailwind.config.ts ./
COPY index.html ./
COPY public ./public
COPY src ./src

# Install dependencies and build
RUN pnpm install --frozen-lockfile && pnpm build

FROM nginx:alpine AS runner

# Use existing nginx user (no need to create new user)

# Install wget for health checks and openssl for certificate generation
RUN apk add --no-cache wget openssl

# Create SSL directory and generate self-signed certificate with better configuration
RUN mkdir -p /etc/nginx/ssl && \
    openssl req -x509 -nodes -days 365 -newkey rsa:4096 \
    -keyout /etc/nginx/ssl/key.pem \
    -out /etc/nginx/ssl/cert.pem \
    -subj "/C=US/ST=State/L=City/O=Organization/OU=IT/CN=localhost" \
    -addext "subjectAltName=DNS:localhost,DNS:*.localhost,IP:127.0.0.1,IP:0.0.0.0" \
    -addext "extendedKeyUsage=serverAuth" \
    -addext "keyUsage=digitalSignature,keyEncipherment"

# Copy nginx configuration and build output
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html

# Set proper permissions
RUN chown -R nginx:nginx /usr/share/nginx/html && \
    chown -R nginx:nginx /var/cache/nginx && \
    chown -R nginx:nginx /var/log/nginx && \
    chown -R nginx:nginx /etc/nginx/conf.d && \
    chown -R nginx:nginx /etc/nginx/ssl && \
    touch /var/run/nginx.pid && \
    chown -R nginx:nginx /var/run/nginx.pid

# Switch to non-root user
USER nginx

EXPOSE 80 443

# Health check - use HTTPS to verify SSL is working
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider --no-check-certificate https://localhost:443/health || exit 1

CMD ["nginx", "-g", "daemon off;"]

# Tag the image for the deploy script
# This will be built as: docker build -t ever-life-vault/web:latest .




