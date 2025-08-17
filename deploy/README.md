# Ever Life Vault Deployment

This directory contains all the necessary files for deploying the Ever Life Vault application using Docker Compose.

## Files Overview

- `docker-compose.yml` - Main production deployment configuration
- `docker-compose.override.yml` - Development overrides (automatically loaded)
- `nginx.conf` - Nginx reverse proxy configuration
- `deploy.sh` - Robust deployment script with rollback capabilities
- `.env` - Environment variables (created during deployment)

## Quick Start

### Prerequisites

- Docker and Docker Compose installed
- Node.js 22+ (for building images)
- Access to required environment variables

### Development Deployment

```bash
# Clone the repository
git clone <repository-url>
cd ever-life-vault

# Build and start services
cd deploy
docker compose up -d --build

# View logs
docker compose logs -f

# Stop services
docker compose down
```

### Production Deployment

Production deployment is handled by Jenkins, but can be run manually:

```bash
# Set environment variables
export WEB_PORT=8080
export PUBLIC_BASE_URL=http://your-domain.com
export ALLOWED_ORIGINS=http://your-domain.com
# ... other environment variables

# Run deployment script
chmod +x deploy.sh
./deploy.sh
```

## Configuration

### Environment Variables

The following environment variables are required:

#### Core Configuration
- `WEB_PORT` - Port to expose the web interface (default: 8080)
- `PUBLIC_BASE_URL` - Base URL for OAuth redirects
- `ALLOWED_ORIGINS` - Comma-separated list of allowed CORS origins
- `ALLOWED_TARGET_HOSTS` - Comma-separated list of allowed proxy targets

#### Supabase Configuration
- `SUPABASE_URL` - Supabase project URL
- `SUPABASE_ANON_KEY` - Supabase anonymous key
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key

#### OAuth Providers (Optional)
- `REDDIT_CLIENT_ID`, `REDDIT_CLIENT_SECRET`, `REDDIT_REDIRECT_URI`
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`
- `MS_CLIENT_ID`, `MS_CLIENT_SECRET`, `MS_REDIRECT_URI`
- `YT_CLIENT_ID`, `YT_CLIENT_SECRET`, `YT_REDIRECT_URI`
- `YTM_CLIENT_ID`, `YTM_CLIENT_SECRET`, `YTM_REDIRECT_URI`
- `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET`, `SPOTIFY_REDIRECT_URI`
- `MAL_CLIENT_ID`, `MAL_CLIENT_SECRET`, `MAL_REDIRECT_URI`, `MAL_TOKENS_SECRET`

#### External Services (Optional)
- `STEAM_WEB_API_KEY` - Steam Web API key
- `JELLYSEERR_BASE`, `JELLYFIN_BASE`, `KARAKEEP_BASE` - Proxy targets

### Nginx Configuration

The Nginx configuration includes:

- **Security Headers**: X-Frame-Options, X-Content-Type-Options, etc.
- **Rate Limiting**: API endpoints limited to 10 req/s, general endpoints to 1 req/s
- **Gzip Compression**: Enabled for text-based content
- **Static Asset Caching**: 30-day cache for JS, CSS, images
- **Health Checks**: `/health` endpoint for monitoring
- **SPA Support**: Fallback to index.html for client-side routing

### Docker Configuration

#### Services

1. **Backend Service**
   - Runs the Fastify server on port 8787
   - Health checks via `/health` endpoint
   - Non-root user for security
   - Comprehensive environment variable support

2. **Web Service**
   - Nginx serving the React SPA
   - Reverse proxy to backend for API routes
   - Health checks and security headers
   - Non-root user for security

#### Networks

- Custom bridge network `ever-life-vault-net` for service communication
- Backend service only exposed internally
- Web service exposed on configured port (default 8080)

#### Health Checks

Both services include health checks:
- **Backend**: HTTP check on `/health` endpoint
- **Web**: HTTP check on root endpoint
- **Intervals**: 30s with 10s timeout, 3 retries

## Deployment Script Features

The `deploy.sh` script provides:

- **Backup & Rollback**: Automatic backup of configuration files with rollback on failure
- **Health Monitoring**: Waits for services to become healthy before completing
- **Cleanup**: Removes old backups and Docker images
- **Error Handling**: Comprehensive error handling with colored output
- **Logging**: Detailed logging of all operations

## Monitoring & Troubleshooting

### Health Checks

Check service health:
```bash
# Check all services
docker compose ps

# Check specific service logs
docker compose logs backend
docker compose logs web

# Check health endpoints directly
curl http://localhost:8080/health  # Web service
curl http://localhost:8787/health  # Backend service (if exposed)
```

### Common Issues

1. **Services not starting**: Check environment variables and Docker logs
2. **502 Bad Gateway**: Backend service may not be healthy
3. **CORS errors**: Check `ALLOWED_ORIGINS` configuration
4. **OAuth not working**: Verify OAuth client credentials and redirect URIs

### Log Locations

- **Application logs**: `docker compose logs -f`
- **Nginx logs**: Inside web container at `/var/log/nginx/`

## Security Considerations

- All services run as non-root users
- Security headers configured in Nginx
- Rate limiting enabled
- Environment variables for sensitive data
- Health checks don't expose sensitive information
- CORS properly configured

## Scaling

To scale the application:

1. **Horizontal scaling**: Add multiple backend instances behind a load balancer
2. **Database scaling**: Configure Supabase for high availability
3. **CDN**: Use a CDN for static assets

## Development vs Production

- **Development**: Uses `docker-compose.override.yml` for local development
- **Production**: Uses Jenkins pipeline with the deployment script
- **Environment**: Different configurations via environment variables
- **Debugging**: Development includes debug ports and volume mounts (when uncommented)