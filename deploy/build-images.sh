#!/bin/bash

# Build script for Ever Life Vault Docker images
# This script builds the images with the correct names for the deploy script

set -euo pipefail

# Colors for output
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

info() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')] INFO: $1${NC}"
}

# Configuration
APP_NAME="ever-life-vault"
FRONTEND_IMAGE="${APP_NAME}/web:latest"
BACKEND_IMAGE="${APP_NAME}/backend:latest"

log "Building Ever Life Vault Docker images..."

# Build frontend image (SSL-enabled nginx)
log "Building frontend image: $FRONTEND_IMAGE"
docker build -t "$FRONTEND_IMAGE" .

if [ $? -eq 0 ]; then
    log "✓ Frontend image built successfully"
else
    error "✗ Frontend image build failed"
    exit 1
fi

# Build backend image
log "Building backend image: $BACKEND_IMAGE"
docker build -t "$BACKEND_IMAGE" ./server

if [ $? -eq 0 ]; then
    log "✓ Backend image built successfully"
else
    error "✗ Backend image build failed"
    exit 1
fi

# Show built images
log "Built images:"
docker images | grep "$APP_NAME"

log ""
log "🎉 All images built successfully!"
log ""
log "Next steps:"
log "1. Run the deployment script: ./deploy.sh"
log "2. Or manually start containers:"
log "   docker run -d --name ${APP_NAME}_backend_1 -p 8787:8787 $BACKEND_IMAGE"
log "   docker run -d --name ${APP_NAME}_web_1 -p 80:80 -p 443:443 $FRONTEND_IMAGE"
log ""
log "The web app will be available at:"
log "  HTTP:  http://localhost (redirects to HTTPS)"
log "  HTTPS: https://localhost"
