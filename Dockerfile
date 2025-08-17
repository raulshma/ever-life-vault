FROM node:22-alpine AS builder
WORKDIR /app

# Enable corepack to use pnpm
ENV COREPACK_ENABLE_STRICT=0
RUN corepack enable

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

# Create non-root user
RUN addgroup -g 1001 -S nginx && \
    adduser -S nginx -u 1001

# Install wget for health checks
RUN apk add --no-cache wget

# Copy nginx configuration and build output
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html

# Set proper permissions
RUN chown -R nginx:nginx /usr/share/nginx/html && \
    chown -R nginx:nginx /var/cache/nginx && \
    chown -R nginx:nginx /var/log/nginx && \
    chown -R nginx:nginx /etc/nginx/conf.d && \
    touch /var/run/nginx.pid && \
    chown -R nginx:nginx /var/run/nginx.pid

# Switch to non-root user
USER nginx

EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:80/health || exit 1

CMD ["nginx", "-g", "daemon off;"]



