#!/bin/bash

# Ever Life Vault Deployment Script
# This script handles the deployment process with proper error handling and rollback

set -euo pipefail

# Configuration
DEPLOY_DIR="${DEPLOY_DIR:-/home/raulshma/apps/ever-life-vault}"
APP_NAME="${APP_NAME:-ever-life-vault}"
BACKUP_DIR="${DEPLOY_DIR}/backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

warn() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING: $1${NC}"
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR: $1${NC}"
}

# Function to create backup
create_backup() {
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
}

# Function to stop containers
stop_containers() {
    log "Stopping existing containers..."
    
    # Stop and remove containers with our app name
    docker ps -a --filter "name=${APP_NAME}" --format "{{.Names}}" | while read container; do
        if [ -n "$container" ]; then
            log "Stopping container: $container"
            docker stop "$container" || warn "Failed to stop $container"
            docker rm "$container" || warn "Failed to remove $container"
        fi
    done
    
    # Remove network if it exists
    docker network rm "${APP_NAME}_app-network" 2>/dev/null || true
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
        cp "$LATEST_COMPOSE" "$DEPLOY_DIR/docker-compose.yml"
        cp "$LATEST_ENV" "$DEPLOY_DIR/.env"
        
        cd "$DEPLOY_DIR"
        start_containers
        
        log "Rollback completed"
    else
        error "No backup found for rollback"
    fi
}

# Function to start containers using native Docker commands
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
        --restart unless-stopped \
        --expose 8787 \
        $ENV_ARGS \
        -e NODE_ENV=production \
        -e HOST=0.0.0.0 \
        -e PORT=8787 \
        ever-life-vault/backend:latest
    
    # Wait for backend to be ready
    log "Waiting for backend to be ready..."
    sleep 10
    
    log "Starting web container..."
    docker run -d \
        --name "${APP_NAME}_web_1" \
        --network "${APP_NAME}_app-network" \
        --restart unless-stopped \
        -p "${WEB_PORT:-8080}:80" \
        $ENV_ARGS \
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

# Function to cleanup old backups (keep last 5)
cleanup_backups() {
    log "Cleaning up old backups..."
    
    # Keep only the 5 most recent backups
    ls -t "$BACKUP_DIR"/docker-compose.yml.* 2>/dev/null | tail -n +6 | xargs rm -f || true
    ls -t "$BACKUP_DIR"/.env.* 2>/dev/null | tail -n +6 | xargs rm -f || true
    
    log "Backup cleanup completed"
}

# Function to cleanup old Docker images
cleanup_docker() {
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

# Main deployment function
deploy() {
    log "Starting deployment of $APP_NAME..."
    
    # Ensure deployment directory exists
    mkdir -p "$DEPLOY_DIR"
    cd "$DEPLOY_DIR"
    
    # Create backup before deployment
    create_backup
    
    # Stop existing services
    stop_containers
    
    # Start new deployment
    log "Starting new deployment..."
    if ! start_containers; then
        rollback
        exit 1
    fi
    
    # Wait for services to be healthy
    if ! wait_for_health; then
        rollback
        exit 1
    fi
    
    # Show deployment status
    log "Deployment completed successfully!"
    docker ps --filter "name=${APP_NAME}" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
    
    # Cleanup
    cleanup_backups
    cleanup_docker
    
    log "All cleanup completed"
}

# Trap to handle errors
trap 'error "Deployment script failed at line $LINENO"' ERR

# Run deployment
deploy