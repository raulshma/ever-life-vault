#!/bin/bash

# Ever Life Vault Manual Rollback Script
# This script allows manual rollback to a previous deployment backup

set -euo pipefail

# Configuration
DEPLOY_DIR="${DEPLOY_DIR:-/home/raulshma/apps/ever-life-vault}"
APP_NAME="${APP_NAME:-ever-life-vault}"
BACKUP_DIR="${DEPLOY_DIR}/backups"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
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

info() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')] INFO: $1${NC}"
}

# Function to list available backups
list_backups() {
    echo "Available backups:"
    echo ""
    
    if [ ! -d "$BACKUP_DIR" ] || [ -z "$(ls -A "$BACKUP_DIR" 2>/dev/null)" ]; then
        echo "No backups found in $BACKUP_DIR"
        return 1
    fi
    
    echo "Backup files:"
    ls -la "$BACKUP_DIR" | grep -E "\.(yml|env)\." | sort -k6,7 | while read -r line; do
        echo "  $line"
    done
    
    echo ""
    echo "Most recent backups:"
    echo "  docker-compose.yml: $(ls -t "$BACKUP_DIR"/docker-compose.yml.* 2>/dev/null | head -n1 | xargs basename 2>/dev/null || echo 'None')"
    echo "  .env: $(ls -t "$BACKUP_DIR"/.env.* 2>/dev/null | head -n1 | xargs basename 2>/dev/null || echo 'None')"
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

# Function to start containers
start_containers() {
    log "Starting containers from backup..."
    
    # Load environment variables from .env file if it exists
    ENV_ARGS=""
    if [ -f "$DEPLOY_DIR/.env" ]; then
        ENV_ARGS="--env-file $DEPLOY_DIR/.env"
    fi
    
    # Create network
    docker network create "${APP_NAME}_app-network" 2>/dev/null || true
    
    # Start backend
    log "Starting backend container..."
    docker run -d \
        --name "${APP_NAME}_backend_1" \
        --network "${APP_NAME}_app-network" \
        --network-alias backend \
        --restart unless-stopped \
        -p "${BACKEND_PORT:-8787}:8787" \
        $ENV_ARGS \
        -e NODE_ENV=production \
        -e HOST=0.0.0.0 \
        -e PORT=8787 \
        ever-life-vault/backend:latest
    
    # Start web
    log "Starting web container..."
    docker run -d \
        --name "${APP_NAME}_web_1" \
        --network "${APP_NAME}_app-network" \
        --network-alias web \
        --restart unless-stopped \
        -p "${WEB_PORT:-8080}:80" \
        -p "${WEB_SSL_PORT:-8443}:443" \
        $ENV_ARGS \
        -e NODE_ENV=production \
        ever-life-vault/web:latest
}

# Function to rollback to specific backup
rollback_to_backup() {
    local backup_timestamp="$1"
    
    log "Rolling back to backup: $backup_timestamp"
    
    # Check if backup files exist
    local compose_backup="$BACKUP_DIR/docker-compose.yml.$backup_timestamp"
    local env_backup="$BACKUP_DIR/.env.$backup_timestamp"
    
    if [ ! -f "$compose_backup" ]; then
        error "Backup file not found: $compose_backup"
        return 1
    fi
    
    if [ ! -f "$env_backup" ]; then
        error "Backup file not found: $env_backup"
        return 1
    fi
    
    # Stop current containers
    stop_containers
    
    # Restore backup files
    log "Restoring backup files..."
    cp "$compose_backup" "$DEPLOY_DIR/docker-compose.yml"
    cp "$env_backup" "$DEPLOY_DIR/.env"
    
    # Start containers
    cd "$DEPLOY_DIR"
    start_containers
    
    log "Rollback completed successfully!"
    
    # Show status
    echo ""
    echo "🚀 Service Status:"
    docker ps --filter "name=${APP_NAME}" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
    echo ""
    echo "📋 Rollback completed to backup: $backup_timestamp"
}

# Function to rollback to most recent backup
rollback_to_latest() {
    log "Rolling back to most recent backup..."
    
    # Find the most recent backup
    local latest_compose=$(ls -t "$BACKUP_DIR"/docker-compose.yml.* 2>/dev/null | head -n1 || echo "")
    local latest_env=$(ls -t "$BACKUP_DIR"/.env.* 2>/dev/null | head -n1 || echo "")
    
    if [ -z "$latest_compose" ] || [ -z "$latest_env" ]; then
        error "No backup files found"
        return 1
    fi
    
    # Extract timestamp from filename
    local timestamp=$(basename "$latest_compose" | sed 's/docker-compose\.yml\.//')
    
    rollback_to_backup "$timestamp"
}

# Function to show usage
show_usage() {
    echo "Ever Life Vault Manual Rollback Script"
    echo ""
    echo "Usage: $0 [OPTIONS] [BACKUP_TIMESTAMP]"
    echo ""
    echo "Options:"
    echo "  -l, --list              List available backups"
    echo "  -r, --rollback          Rollback to most recent backup"
    echo "  -h, --help              Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 --list                                    # List available backups"
    echo "  $0 --rollback                               # Rollback to most recent backup"
    echo "  $0 20250115_143022                         # Rollback to specific backup"
    echo ""
    echo "Environment variables:"
    echo "  DEPLOY_DIR     Deployment directory (default: /home/raulshma/apps/ever-life-vault)"
    echo "  APP_NAME       Application name (default: ever-life-vault)"
    echo "  WEB_PORT       Web port (default: 8080)"
    echo "  BACKEND_PORT   Backend port (default: 8787)"
    echo "  WEB_SSL_PORT   Web SSL port (default: 8443)"
}

# Main script logic
main() {
    # Parse command line arguments
    case "${1:-}" in
        -l|--list)
            list_backups
            exit 0
            ;;
        -r|--rollback)
            rollback_to_latest
            exit 0
            ;;
        -h|--help|"")
            show_usage
            exit 0
            ;;
        *)
            # Assume it's a backup timestamp
            if [[ "$1" =~ ^[0-9]{8}_[0-9]{6}$ ]]; then
                rollback_to_backup "$1"
            else
                error "Invalid backup timestamp format. Expected: YYYYMMDD_HHMMSS"
                echo ""
                show_usage
                exit 1
            fi
            ;;
    esac
}

# Run main function with all arguments
main "$@"
