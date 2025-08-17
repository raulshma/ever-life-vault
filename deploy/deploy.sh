#!/bin/bash

# Ever Life Vault Deployment Script
# This script handles the deployment process with proper error handling and rollback
# Updated to support SSL/HTTPS with crypto.subtle compatibility and revert mode

set -euo pipefail

# Configuration
DEPLOY_DIR="${DEPLOY_DIR:-/home/raulshma/apps/ever-life-vault}"
APP_NAME="${APP_NAME:-ever-life-vault}"
BACKUP_DIR="${DEPLOY_DIR}/backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
REVERT_MODE="${REVERT_MODE:-false}"

# Port configuration - updated for SSL support (preserve existing defaults)
WEB_PORT="${WEB_PORT:-8080}"
WEB_SSL_PORT="${WEB_SSL_PORT:-8443}"
BACKEND_PORT="${BACKEND_PORT:-8787}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging configuration
LOG_FILE="${DEPLOY_DIR}/deploy.log"
LOG_LEVEL="${LOG_LEVEL:-INFO}"

log() {
    local level="INFO"
    local message="$1"
    local timestamp=$(date +'%Y-%m-%d %H:%M:%S')
    
    echo -e "${GREEN}[${timestamp}] $1${NC}"
    echo "[${timestamp}] [${level}] $1" >> "$LOG_FILE"
}

warn() {
    local level="WARN"
    local message="$1"
    local timestamp=$(date +'%Y-%m-%d %H:%M:%S')
    
    echo -e "${YELLOW}[${timestamp}] WARNING: $1${NC}"
    echo "[${timestamp}] [${level}] WARNING: $1" >> "$LOG_FILE"
}

error() {
    local level="ERROR"
    local message="$1"
    local timestamp=$(date +'%Y-%m-%d %H:%M:%S')
    
    echo -e "${RED}[${timestamp}] ERROR: $1${NC}"
    echo "[${timestamp}] [${level}] ERROR: $1" >> "$LOG_FILE"
}

info() {
    local level="INFO"
    local message="$1"
    local timestamp=$(date +'%Y-%m-%d %H:%M:%S')
    
    echo -e "${BLUE}[${timestamp}] INFO: $1${NC}"
    echo "[${timestamp}] [${level}] INFO: $1" >> "$LOG_FILE"
}

# Function to check system requirements
check_system_requirements() {
    log "Checking system requirements..."
    
    # Check Docker availability
    if ! command -v docker &> /dev/null; then
        error "Docker is not installed or not in PATH"
        exit 1
    fi
    
    # Check Docker daemon
    if ! docker info &> /dev/null; then
        error "Docker daemon is not running"
        exit 1
    fi
    
    # Check available disk space (require at least 2GB free)
    local available_space=$(df -BG . | awk 'NR==2 {print $4}' | sed 's/G//')
    if [ "$available_space" -lt 2 ]; then
        warn "Low disk space: ${available_space}GB available (recommended: 2GB+)"
    fi
    
    # Check available memory (require at least 1GB free)
    local available_memory=$(free -m | awk 'NR==2 {print $7}')
    if [ "$available_memory" -lt 1024 ]; then
        warn "Low memory: ${available_memory}MB available (recommended: 1GB+)"
    fi
    
    log "System requirements check passed"
}

# Function to validate Turnstile configuration
validate_turnstile_config() {
    if [ "$REVERT_MODE" = "true" ]; then
        log "Revert mode - skipping Turnstile validation"
        return 0
    fi
    
    if [ -z "${TURNSTILE_SECRET_KEY:-}" ]; then
        warn "TURNSTILE_SECRET_KEY not set - Turnstile verification will be disabled"
        return 0
    fi
    
    if [ -z "${TURNSTILE_SITE_KEY:-}" ]; then
        warn "TURNSTILE_SITE_KEY not set - Turnstile widget will not render"
        return 0
    fi
    
    log "✓ Turnstile configuration validated"
    log "  Site Key: ${TURNSTILE_SITE_KEY:0:8}..."
    log "  Secret Key: ${TURNSTILE_SECRET_KEY:0:8}..."
}

# Function to validate Docker images
validate_docker_images() {
    log "Validating Docker images..."
    
    # Check if required images exist
    if ! docker image inspect "${APP_NAME}/backend:latest" &> /dev/null; then
        error "Backend image not found: ${APP_NAME}/backend:latest"
        exit 1
    fi
    
    if ! docker image inspect "${APP_NAME}/web:latest" &> /dev/null; then
        error "Web image not found: ${APP_NAME}/web:latest"
        exit 1
    fi
    
    # Show image information
    log "Docker images validated:"
    docker images --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}\t{{.CreatedAt}}" | grep "$APP_NAME"
    
    # Check image sizes (warn if too large)
    local backend_size=$(docker images --format "{{.Size}}" "${APP_NAME}/backend:latest" | sed 's/[^0-9]//g')
    local web_size=$(docker images --format "{{.Size}}" "${APP_NAME}/web:latest" | sed 's/[^0-9]//g')
    
    if [ "$backend_size" -gt 500 ]; then
        warn "Backend image is large: ${backend_size}MB (consider optimizing)"
    fi
    
    if [ "$web_size" -gt 300 ]; then
        warn "Web image is large: ${web_size}MB (consider optimizing)"
    fi
}

# Function to create backup
create_backup() {
    if [ "$REVERT_MODE" = "true" ]; then
        log "Revert mode - skipping backup creation"
        return 0
    fi
    
    log "Creating backup..."
    mkdir -p "$BACKUP_DIR"
    
    if [ -f "$DEPLOY_DIR/docker-compose.yml" ]; then
        cp "$DEPLOY_DIR/docker-compose.yml" "$BACKUP_DIR/docker-compose.yml.$TIMESTAMP"
        log "Backed up docker-compose.yml"
    fi
    
    if [ -f "$DEPLOY_DIR/.env" ]; then
        cp "$DEPLOY_DIR/.env" "$BACKUP_DIR/.env.$TIMESTAMP"
        log "Backed up .env file"
    fi
    
    # Create backup manifest
    cat > "$BACKUP_DIR/backup-manifest.$TIMESTAMP" << EOF
Backup created: $TIMESTAMP
Deployment: $APP_NAME
Files:
- docker-compose.yml.$TIMESTAMP
- .env.$TIMESTAMP
EOF
    
    log "Backup completed: $TIMESTAMP"
}

# Function to stop containers
stop_containers() {
    log "Stopping existing containers..."
    
    # Stop and remove containers with our app name
    local containers=$(docker ps -a --filter "name=${APP_NAME}" --format "{{.Names}}")
    
    if [ -n "$containers" ]; then
        echo "$containers" | while read container; do
            if [ -n "$container" ]; then
                log "Stopping container: $container"
                docker stop "$container" || warn "Failed to stop $container"
                docker rm "$container" || warn "Failed to remove $container"
            fi
        done
    else
        log "No existing containers found"
    fi
    
    # Remove network if it exists
    docker network rm "${APP_NAME}_app-network" 2>/dev/null || true
    
    log "Container cleanup completed"
}

# Function to rollback
rollback() {
    error "Deployment failed. Attempting rollback..."
    
    # Stop current containers
    stop_containers
    
    # Find the most recent backup
    LATEST_COMPOSE=$(ls -t "$BACKUP_DIR"/docker-compose.yml.* 2>/dev/null | head -n1 || echo "")
    LATEST_ENV=$(ls -t "$BACKUP_DIR"/.env.* 2>/dev/null | head -n1 || echo "")
    
    if [ -n "$LATEST_COMPOSE" ] && [ -n "$LATEST_ENV" ]; then
        log "Restoring from backup..."
        cp "$LATEST_COMPOSE" "$DEPLOY_DIR/docker-compose.yml"
        cp "$LATEST_ENV" "$DEPLOY_DIR/.env"
        
        cd "$DEPLOY_DIR"
        start_containers
        
        log "Rollback completed successfully"
    else
        error "No backup found for rollback"
        exit 1
    fi
}

# Function to start containers using native Docker commands with SSL support
start_containers() {
    log "Creating network..."
    docker network create "${APP_NAME}_app-network" 2>/dev/null || true
    
    # Load environment variables from .env file if it exists
    ENV_ARGS=""
    if [ -f "$DEPLOY_DIR/.env" ]; then
        ENV_ARGS="--env-file $DEPLOY_DIR/.env"
    fi
    
    log "Starting backend container..."
    docker run -d \
        --name "${APP_NAME}_backend_1" \
        --network "${APP_NAME}_app-network" \
        --network-alias backend \
        --restart unless-stopped \
        -p "${BACKEND_PORT}:8787" \
        $ENV_ARGS \
        -e NODE_ENV=production \
        -e HOST=0.0.0.0 \
        -e PORT=8787 \
        --memory="1g" \
        --cpus="1.0" \
        --security-opt no-new-privileges \
        --cap-drop=ALL \
        --cap-add=CHOWN \
        --cap-add=SETGID \
        --cap-add=SETUID \
        ever-life-vault/backend:latest
    
    # Wait for backend healthcheck to be healthy (max ~60s)
    log "Waiting for backend to be healthy..."
    attempt=1
    max_attempts=30
    while [ $attempt -le $max_attempts ]; do
        status=$(docker inspect --format='{{json .State.Health.Status}}' "${APP_NAME}_backend_1" 2>/dev/null || echo "\"unknown\"")
        if [ "$status" = '"healthy"' ]; then
            log "Backend is healthy"
            break
        fi
        log "Attempt $attempt/$max_attempts: backend status=$status; waiting..."
        sleep 2
        ((attempt++))
    done
    if [ "$status" != '"healthy"' ]; then
        error "Backend failed to become healthy in time"
        exit 1
    fi
    
    log "Starting web container with SSL support..."
    info "Web container will be accessible on:"
    info "  HTTP:  http://localhost:${WEB_PORT} (redirects to HTTPS)"
    info "  HTTPS: https://localhost:${WEB_SSL_PORT}"
    
    docker run -d \
        --name "${APP_NAME}_web_1" \
        --network "${APP_NAME}_app-network" \
        --network-alias web \
        --restart unless-stopped \
        -p "${WEB_PORT}:80" \
        -p "${WEB_SSL_PORT}:443" \
        $ENV_ARGS \
        -e NODE_ENV=production \
        --memory="512m" \
        --cpus="0.5" \
        --security-opt no-new-privileges \
        --cap-drop=ALL \
        --cap-add=CHOWN \
        --cap-add=SETGID \
        --cap-add=SETUID \
        --cap-add=NET_BIND_SERVICE \
        ever-life-vault/web:latest
}

# Function to wait for services to be healthy
wait_for_health() {
    log "Waiting for services to be healthy..."
    local max_attempts=24  # 2 minutes with 5-second intervals
    local attempt=1
    
    while [ $attempt -le $max_attempts ]; do
        # Check if both containers are running
        backend_running=$(docker ps --filter "name=${APP_NAME}_backend_1" --filter "status=running" --format "{{.Names}}" | wc -l)
        web_running=$(docker ps --filter "name=${APP_NAME}_web_1" --filter "status=running" --format "{{.Names}}" | wc -l)
        
        if [ "$backend_running" -eq 1 ] && [ "$web_running" -eq 1 ]; then
            log "Services are running"
            return 0
        fi
        
        log "Attempt $attempt/$max_attempts: Services not yet ready, waiting..."
        sleep 5
        ((attempt++))
    done
    
    error "Services failed to start within timeout"
    return 1
}

# Function to test SSL functionality
test_ssl() {
    log "Testing SSL configuration..."
    
    # Wait a bit for nginx to fully start
    sleep 5
    
    # Test HTTP to HTTPS redirect
    if command -v curl &> /dev/null; then
        log "Testing HTTP to HTTPS redirect..."
        http_response=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:${WEB_PORT}/health" || echo "000")
        if [ "$http_response" = "301" ] || [ "$http_response" = "302" ]; then
            log "✓ HTTP to HTTPS redirect working"
        else
            warn "HTTP to HTTPS redirect may not be working (response: $http_response)"
        fi
        
        # Test HTTPS endpoint
        log "Testing HTTPS endpoint..."
        https_response=$(curl -s -o /dev/null -w "%{http_code}" -k "https://localhost:${WEB_SSL_PORT}/health" || echo "000")
        if [ "$https_response" = "200" ]; then
            log "✓ HTTPS endpoint working"
        else
            warn "HTTPS endpoint may not be working (response: $https_response)"
        fi
        
        # Test security headers
        log "Testing security headers..."
        security_headers=$(curl -s -I -k "https://localhost:${WEB_SSL_PORT}/" | grep -E "(X-Frame-Options|X-Content-Type-Options|X-XSS-Protection|Strict-Transport-Security)" || echo "")
        if [ -n "$security_headers" ]; then
            log "✓ Security headers present"
        else
            warn "Security headers may be missing"
        fi
    else
        warn "curl not available - SSL testing skipped"
    fi
}

# Function to test Turnstile service
test_turnstile() {
    if [ "$REVERT_MODE" = "true" ]; then
        log "Revert mode - skipping Turnstile testing"
        return 0
    fi
    
    if [ -z "${TURNSTILE_SECRET_KEY:-}" ]; then
        log "Turnstile not configured - skipping test"
        return 0
    fi
    
    log "Testing Turnstile service..."
    
    # Wait for backend to be fully ready
    sleep 5
    
    if command -v curl &> /dev/null; then
        log "Testing Turnstile health endpoint..."
        health_response=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:${BACKEND_PORT}/auth/turnstile-health" || echo "000")
        if [ "$health_response" = "200" ]; then
            log "✓ Turnstile service is healthy"
        else
            warn "Turnstile service may not be working (response: $health_response)"
        fi
    else
        warn "curl not available - Turnstile testing skipped"
    fi
}

# Function to cleanup old backups (keep last 5)
cleanup_backups() {
    if [ "$REVERT_MODE" = "true" ]; then
        log "Revert mode - skipping backup cleanup"
        return 0
    fi
    
    log "Cleaning up old backups..."
    
    # Keep only the 5 most recent backups
    ls -t "$BACKUP_DIR"/docker-compose.yml.* 2>/dev/null | tail -n +6 | xargs rm -f || true
    ls -t "$BACKUP_DIR"/.env.* 2>/dev/null | tail -n +6 | xargs rm -f || true
    ls -t "$BACKUP_DIR"/backup-manifest.* 2>/dev/null | tail -n +6 | xargs rm -f || true
    
    log "Backup cleanup completed"
}

# Function to cleanup old Docker images
cleanup_docker() {
    if [ "$REVERT_MODE" = "true" ]; then
        log "Revert mode - skipping Docker cleanup"
        return 0
    fi
    
    log "Cleaning up old Docker images..."
    
    # Remove dangling images
    docker image prune -f || warn "Failed to prune dangling images"
    
    # Remove old versions of our app images (keep last 3)
    docker images --format "{{.Repository}}:{{.Tag}}" | \
        grep "$APP_NAME" | \
        tail -n +4 | \
        xargs -r docker rmi || warn "Failed to remove old app images"
    
    log "Docker cleanup completed"
}

# Function to show deployment summary
show_summary() {
    if [ "$REVERT_MODE" = "true" ]; then
        log "Revert to last build completed successfully!"
    else
        log "Deployment completed successfully!"
    fi
    
    echo ""
    echo "🚀 Service Status:"
    docker ps --filter "name=${APP_NAME}" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
    echo ""
    echo "🌐 Access Information:"
    echo "  Backend API: http://localhost:${BACKEND_PORT}"
    echo "  Web App (HTTP):  http://localhost:${WEB_PORT} (redirects to HTTPS)"
    echo "  Web App (HTTPS): https://localhost:${WEB_SSL_PORT}"
    echo ""
    
    if [ "$REVERT_MODE" = "true" ]; then
        echo "🔄 Revert Information:"
        echo "  ✓ Successfully reverted to previous deployment"
        echo "  ✓ Services restored from last successful build"
    else
        echo "🔒 SSL Features:"
        echo "  ✓ HTTPS enabled with self-signed certificate"
        echo "  ✓ HTTP to HTTPS redirect"
        echo "  ✓ crypto.subtle API available (vault unlock will work)"
        echo ""
        
        # Show Turnstile status
        if [ -n "${TURNSTILE_SECRET_KEY:-}" ] && [ -n "${TURNSTILE_SITE_KEY:-}" ]; then
            echo "🛡️  Turnstile Protection:"
            echo "  ✓ Bot protection enabled for authentication"
            echo "  ✓ Server-side verification configured"
            echo "  ✓ Client-side widget will render"
        else
            echo "⚠️  Turnstile Protection:"
            echo "  - Bot protection disabled (keys not configured)"
            echo "  - Authentication forms will work without verification"
        fi
        
        echo ""
        echo "⚠️  Important Notes:"
        echo "  - Browser will show security warning for self-signed certificate"
        echo "  - Click 'Advanced' → 'Proceed to localhost (unsafe)' to continue"
        echo "  - For production, replace with real SSL certificate"
    fi
    
    echo ""
    echo "📋 Useful Commands:"
    echo "  View logs: docker logs -f ${APP_NAME}_web_1"
    echo "  View backend logs: docker logs -f ${APP_NAME}_backend_1"
    echo "  Stop services: docker stop ${APP_NAME}_web_1 ${APP_NAME}_backend_1"
    echo "  Restart: ./deploy.sh"
    echo "  View deployment log: tail -f ${LOG_FILE}"
    
    if [ "$REVERT_MODE" = "true" ]; then
        echo "  Note: This is a revert deployment - new changes will require a fresh build"
    fi
}

# Function to monitor deployment
monitor_deployment() {
    log "Starting deployment monitoring..."
    
    # Monitor container logs for errors
    (
        docker logs -f "${APP_NAME}_backend_1" 2>&1 | grep -i "error\|fatal\|exception" | head -10 &
        docker logs -f "${APP_NAME}_web_1" 2>&1 | grep -i "error\|fatal\|exception" | head -10 &
        wait
    ) &
    
    # Monitor resource usage
    (
        while true; do
            echo "Resource usage:"
            docker stats --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}" | grep "$APP_NAME" || true
            sleep 30
        done
    ) &
    
    log "Monitoring started (will continue in background)"
}

# Main deployment function
deploy() {
    if [ "$REVERT_MODE" = "true" ]; then
        log "Starting revert to last build for $APP_NAME..."
    else
        log "Starting deployment of $APP_NAME with SSL support..."
    fi
    
    # Initialize logging
    mkdir -p "$(dirname "$LOG_FILE")"
    echo "=== Deployment started at $(date) ===" > "$LOG_FILE"
    
    # Ensure deployment directory exists
    mkdir -p "$DEPLOY_DIR"
    cd "$DEPLOY_DIR"
    
    # System checks
    check_system_requirements
    
    # Validate configuration
    validate_turnstile_config
    
    if [ "$REVERT_MODE" = "false" ]; then
        validate_docker_images
    fi
    
    # Create backup before deployment (unless in revert mode)
    create_backup
    
    # Stop existing services
    stop_containers
    
    # Start new deployment
    if [ "$REVERT_MODE" = "true" ]; then
        log "Starting revert deployment..."
    else
        log "Starting new deployment with SSL support..."
    fi
    
    if ! start_containers; then
        rollback
        exit 1
    fi
    
    # Wait for services to be healthy
    if ! wait_for_health; then
        rollback
        exit 1
    fi
    
    # Test SSL functionality (skip in revert mode if SSL config might be different)
    if [ "$REVERT_MODE" = "false" ]; then
        test_ssl
        test_turnstile
    fi
    
    # Start monitoring
    monitor_deployment
    
    # Show deployment summary
    show_summary
    
    # Cleanup (skip in revert mode)
    cleanup_backups
    cleanup_docker
    
    log "All cleanup completed"
    echo "=== Deployment completed at $(date) ===" >> "$LOG_FILE"
}

# Trap to handle errors
trap 'error "Deployment script failed at line $LINENO"' ERR

# Run deployment
deploy