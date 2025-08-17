# Ever Life Vault - Jenkins & Docker Deployment

This directory contains the improved Jenkins and Docker deployment configuration for the Ever Life Vault application.

## 🚀 Overview

The deployment system has been significantly improved with:

- **Enhanced Security**: Non-root containers, security headers, rate limiting
- **Better Monitoring**: Health checks, logging, resource monitoring
- **Improved CI/CD**: Parallel stages, better error handling, security scanning
- **Resource Management**: Memory/CPU limits, efficient cleanup
- **Development Support**: Development profiles, hot reloading, debugging

## 📁 File Structure

```
deploy/
├── README.md                 # This file
├── docker-compose.yml        # Production Docker Compose configuration
├── docker-compose.override.yml # Development override configuration
├── deploy.sh                 # Main deployment script
├── rollback.sh              # Manual rollback script
├── build-images.sh          # Image building script
├── security-scan.sh         # Security scanning script
├── nginx.conf               # Enhanced nginx configuration
└── monitoring/
    └── prometheus.yml       # Prometheus monitoring configuration
```

## 🔧 Prerequisites

### System Requirements
- **Docker**: Version 20.10+ with BuildKit enabled
- **Disk Space**: Minimum 2GB free space
- **Memory**: Minimum 1GB available RAM
- **OS**: Linux (tested on Ubuntu 20.04+, Alpine, and Raspberry Pi OS)

### Optional Tools
- **Trivy**: For vulnerability scanning
- **Dive**: For Docker image layer analysis
- **Docker Slim**: For image optimization

## 🐳 Docker Configuration

### Production Images

#### Frontend (Web)
- **Base**: `nginx:alpine`
- **Features**: SSL/TLS, security headers, rate limiting
- **Ports**: 80 (HTTP), 443 (HTTPS)
- **Security**: Non-root user, minimal capabilities

#### Backend (API)
- **Base**: `node:22-alpine`
- **Features**: TypeScript, health checks, monitoring
- **Ports**: 8787 (API)
- **Security**: Non-root user, resource limits

### Development Images
- **Hot Reloading**: Source code mounted for live development
- **Debug Ports**: Node.js debugging enabled
- **Development Tools**: Additional development dependencies

## 🚀 Deployment

### Quick Start

1. **Build Images**:
   ```bash
   ./build-images.sh
   ```

2. **Deploy**:
   ```bash
   ./deploy.sh
   ```

3. **Access**:
   - Web App: http://localhost:8080 → https://localhost:8443
   - API: http://localhost:8787

### Environment Variables

Create a `.env` file with:

```bash
# Ports
WEB_PORT=8080
BACKEND_PORT=8787
WEB_SSL_PORT=8443

# Application
PUBLIC_BASE_URL=http://localhost:8080
ALLOWED_ORIGINS=http://localhost:8080

# Supabase
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_key

# OAuth Providers (optional)
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
# ... other providers

# Turnstile (optional)
TURNSTILE_SITE_KEY=your_turnstile_site_key
TURNSTILE_SECRET_KEY=your_turnstile_secret_key
```

### Development Mode

```bash
# Start development environment
docker-compose --profile dev up

# Start with monitoring
docker-compose --profile dev --profile monitoring up

# Start specific services
docker-compose --profile dev up frontend backend
```

## 🔒 Security Features

### Container Security
- **Non-root Users**: All containers run as non-root users
- **Capability Dropping**: Minimal Linux capabilities
- **Read-only Filesystems**: Temporary filesystems for writable areas
- **Security Options**: `no-new-privileges` enabled

### Network Security
- **Rate Limiting**: API endpoints protected against abuse
- **Security Headers**: Comprehensive security headers
- **SSL/TLS**: Self-signed certificates with modern ciphers
- **CORS Protection**: Configurable allowed origins

### Application Security
- **Input Validation**: Request validation and sanitization
- **Authentication**: OAuth integration with multiple providers
- **Bot Protection**: Cloudflare Turnstile integration
- **Secret Management**: Environment-based configuration

## 📊 Monitoring & Observability

### Health Checks
- **Backend**: `/health` endpoint with wget verification
- **Frontend**: Nginx health check with SSL verification
- **Interval**: 30 seconds with 3 retries

### Logging
- **Structured Logging**: JSON format with timestamps
- **Log Rotation**: Automatic cleanup of old logs
- **Log Levels**: INFO, WARN, ERROR with color coding

### Metrics
- **Prometheus**: Container and application metrics
- **Grafana**: Visualization dashboard (development profile)
- **Resource Monitoring**: CPU, memory, network usage

## 🔄 CI/CD Pipeline

### Jenkins Pipeline Stages

1. **Checkout**: Git repository with credential management
2. **Environment Validation**: System requirements check
3. **Revert Check**: Rollback capability for failed deployments
4. **Testing**: Frontend and backend test execution
5. **Build Images**: Multi-stage Docker builds with optimization
6. **Security Scan**: Vulnerability and best practice scanning
7. **Deploy**: Production deployment with health checks
8. **Post-Deployment Tests**: Service validation and SSL testing

### Pipeline Parameters

- `WEB_PORT`: Web application port (default: 8080)
- `BACKEND_PORT`: Backend API port (default: 8787)
- `REVERT_TO_LAST_BUILD`: Rollback to previous version
- `SKIP_TESTS`: Skip test execution for faster deployment
- `FORCE_REBUILD`: Force rebuild without Docker cache
- `BUILD_STRATEGY`: Build optimization strategy

### Build Optimization

- **Multi-stage Builds**: Separate build and runtime stages
- **Layer Caching**: Efficient Docker layer reuse
- **Resource Limits**: Memory and CPU constraints during build
- **Parallel Processing**: Concurrent image building

## 🛡️ Security Scanning

### Automated Security Checks

```bash
# Run security scan
./security-scan.sh

# Scan results stored in:
# - security-scans/trivy-*.json (vulnerabilities)
# - security-scans/dive-*.txt (layer analysis)
# - security-scans/best-practices-*.txt (security practices)
# - security-scans/security-report-*.md (comprehensive report)
```

### Security Tools Integration

- **Trivy**: Vulnerability scanning for container images
- **Dive**: Docker image layer efficiency analysis
- **Custom Checks**: Security best practices validation

## 📈 Performance Optimization

### Docker Optimizations
- **Alpine Base Images**: Minimal attack surface
- **Multi-stage Builds**: Reduced final image size
- **Layer Optimization**: Efficient dependency management
- **Build Caching**: Incremental build improvements

### Nginx Optimizations
- **Gzip Compression**: Efficient content delivery
- **Static Caching**: Aggressive caching for static assets
- **Connection Pooling**: Optimized proxy connections
- **Rate Limiting**: Protection against abuse

### Resource Management
- **Memory Limits**: Container memory constraints
- **CPU Limits**: CPU usage restrictions
- **Network Optimization**: Efficient network configuration
- **Storage Cleanup**: Automatic cleanup of old images

## 🚨 Troubleshooting

### Common Issues

#### Container Won't Start
```bash
# Check logs
docker logs ever-life-vault_backend_1
docker logs ever-life-vault_web_1

# Check container status
docker ps -a --filter "name=ever-life-vault"

# Verify image exists
docker images | grep ever-life-vault
```

#### SSL Issues
```bash
# Test SSL configuration
curl -k https://localhost:8443/health

# Check nginx configuration
docker exec ever-life-vault_web_1 nginx -t

# Verify certificate
docker exec ever-life-vault_web_1 openssl x509 -in /etc/nginx/ssl/cert.pem -text
```

#### Performance Issues
```bash
# Check resource usage
docker stats ever-life-vault_backend_1 ever-life-vault_web_1

# Monitor logs for errors
docker logs -f ever-life-vault_backend_1 | grep -i error

# Check disk space
df -h
```

### Rollback Procedure

```bash
# Automatic rollback (Jenkins)
# Set REVERT_TO_LAST_BUILD=true parameter

# Manual rollback
./rollback.sh --rollback

# Specific backup rollback
./rollback.sh 20250115_143022
```

## 🔧 Maintenance

### Regular Tasks

1. **Security Updates**: Run security scans weekly
2. **Image Updates**: Update base images monthly
3. **Log Cleanup**: Monitor log file sizes
4. **Backup Rotation**: Review backup retention policy
5. **Performance Monitoring**: Check resource usage trends

### Backup Management

```bash
# List available backups
./rollback.sh --list

# Backup location
ls -la /home/raulshma/apps/ever-life-vault/backups/

# Manual backup
cp docker-compose.yml backups/docker-compose.yml.$(date +%Y%m%d_%H%M%S)
cp .env backups/.env.$(date +%Y%m%d_%H%M%S)
```

## 📚 Additional Resources

### Documentation
- [Docker Best Practices](https://docs.docker.com/develop/dev-best-practices/)
- [Nginx Security](https://nginx.org/en/docs/http/ngx_http_core_module.html)
- [Jenkins Pipeline](https://www.jenkins.io/doc/book/pipeline/)

### Security Resources
- [OWASP Container Security](https://owasp.org/www-project-container-security-top-10/)
- [Docker Security](https://docs.docker.com/engine/security/)
- [Nginx Security Headers](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers)

### Monitoring Resources
- [Prometheus Documentation](https://prometheus.io/docs/)
- [Grafana Documentation](https://grafana.com/docs/)
- [Docker Monitoring](https://docs.docker.com/config/daemon/logging/)

## 🤝 Contributing

When contributing to the deployment configuration:

1. **Test Changes**: Test all changes in development environment
2. **Security Review**: Ensure security best practices are maintained
3. **Documentation**: Update this README for any new features
4. **Backward Compatibility**: Maintain compatibility with existing deployments

## 📄 License

This deployment configuration is part of the Ever Life Vault project and follows the same licensing terms.

---

**Last Updated**: January 2025  
**Version**: 2.0.0  
**Maintainer**: Ever Life Vault Team