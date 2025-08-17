#!/bin/bash

# Docker Security Scanning Script for Ever Life Vault
# This script performs security scans on Docker images

set -euo pipefail

# Configuration
APP_NAME="ever-life-vault"
SCAN_DIR="${SCAN_DIR:-./security-scans}"
LOG_FILE="${SCAN_DIR}/security-scan.log"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log() {
    local timestamp=$(date +'%Y-%m-%d %H:%M:%S')
    echo -e "${GREEN}[${timestamp}] $1${NC}"
    echo "[${timestamp}] INFO: $1" >> "$LOG_FILE"
}

warn() {
    local timestamp=$(date +'%Y-%m-%d %H:%M:%S')
    echo -e "${YELLOW}[${timestamp}] WARNING: $1${NC}"
    echo "[${timestamp}] WARNING: $1" >> "$LOG_FILE"
}

error() {
    local timestamp=$(date +'%Y-%m-%d %H:%M:%S')
    echo -e "${RED}[${timestamp}] ERROR: $1${NC}"
    echo "[${timestamp}] ERROR: $1" >> "$LOG_FILE"
}

info() {
    local timestamp=$(date +'%Y-%m-%d %H:%M:%S')
    echo -e "${BLUE}[${timestamp}] INFO: $1${NC}"
    echo "[${timestamp}] INFO: $1" >> "$LOG_FILE"
}

# Function to check prerequisites
check_prerequisites() {
    log "Checking prerequisites..."
    
    # Check if Docker is available
    if ! command -v docker &> /dev/null; then
        error "Docker is not installed or not in PATH"
        exit 1
    fi
    
    # Check if required tools are available
    local missing_tools=()
    
    if ! command -v trivy &> /dev/null; then
        missing_tools+=("trivy")
    fi
    
    if ! command -v dive &> /dev/null; then
        missing_tools+=("dive")
    fi
    
    if ! command -v docker-slim &> /dev/null; then
        missing_tools+=("docker-slim")
    fi
    
    if [ ${#missing_tools[@]} -gt 0 ]; then
        warn "Some security tools are not available: ${missing_tools[*]}"
        warn "Install them for comprehensive security scanning:"
        warn "  - Trivy: https://aquasecurity.github.io/trivy/latest/getting-started/installation/"
        warn "  - Dive: https://github.com/wagoodman/dive#installation"
        warn "  - Docker Slim: https://github.com/docker-slim/docker-slim#installation"
    fi
    
    log "Prerequisites check completed"
}

# Function to create scan directory
create_scan_directory() {
    log "Creating scan directory..."
    mkdir -p "$SCAN_DIR"
    echo "=== Security Scan started at $(date) ===" > "$LOG_FILE"
    log "Scan directory created: $SCAN_DIR"
}

# Function to scan Docker images with Trivy
scan_with_trivy() {
    if ! command -v trivy &> /dev/null; then
        warn "Trivy not available, skipping vulnerability scan"
        return 0
    fi
    
    log "Starting Trivy vulnerability scan..."
    
    local images=("${APP_NAME}/backend:latest" "${APP_NAME}/web:latest")
    
    for image in "${images[@]}"; do
        if docker image inspect "$image" &> /dev/null; then
            log "Scanning image: $image"
            
            local scan_file="${SCAN_DIR}/trivy-$(echo "$image" | tr '/' '_' | tr ':' '_').json"
            
            # Run Trivy scan
            trivy image \
                --format json \
                --output "$scan_file" \
                --severity HIGH,CRITICAL \
                "$image" || {
                warn "Trivy scan completed with findings for $image"
            }
            
            # Generate HTML report
            trivy image \
                --format html \
                --output "${scan_file%.json}.html" \
                --severity HIGH,CRITICAL \
                "$image" || true
            
            log "Trivy scan completed for $image"
        else
            warn "Image not found: $image"
        fi
    done
}

# Function to analyze Docker image layers with Dive
analyze_with_dive() {
    if ! command -v dive &> /dev/null; then
        warn "Dive not available, skipping layer analysis"
        return 0
    fi
    
    log "Starting Dive layer analysis..."
    
    local images=("${APP_NAME}/backend:latest" "${APP_NAME}/web:latest")
    
    for image in "${images[@]}"; do
        if docker image inspect "$image" &> /dev/null; then
            log "Analyzing image layers: $image"
            
            local analysis_file="${SCAN_DIR}/dive-$(echo "$image" | tr '/' '_' | tr ':' '_').txt"
            
            # Run Dive analysis (non-interactive)
            dive "$image" --ci --lowestEfficiency 0.8 > "$analysis_file" 2>&1 || {
                warn "Dive analysis completed with findings for $image"
            }
            
            log "Dive analysis completed for $image"
        else
            warn "Image not found: $image"
        fi
    done
}

# Function to check Docker image security best practices
check_security_best_practices() {
    log "Checking security best practices..."
    
    local images=("${APP_NAME}/backend:latest" "${APP_NAME}/web:latest")
    
    for image in "${images[@]}"; do
        if docker image inspect "$image" &> /dev/null; then
            log "Checking best practices for: $image"
            
            local report_file="${SCAN_DIR}/best-practices-$(echo "$image" | tr '/' '_' | tr ':' '_').txt"
            
            # Check image size
            local size=$(docker images --format "{{.Size}}" "$image")
            echo "Image Size: $size" > "$report_file"
            
            # Check if running as root
            local user=$(docker run --rm "$image" whoami 2>/dev/null || echo "unknown")
            echo "User: $user" >> "$report_file"
            
            if [ "$user" = "root" ]; then
                warn "Image $image is running as root (security risk)"
                echo "⚠️  SECURITY RISK: Running as root" >> "$report_file"
            else
                log "✓ Image $image is not running as root"
                echo "✓ Not running as root" >> "$report_file"
            fi
            
            # Check exposed ports
            local ports=$(docker image inspect "$image" --format '{{range .Config.ExposedPorts}}{{.}}{{end}}')
            echo "Exposed Ports: $ports" >> "$report_file"
            
            # Check environment variables
            local env_vars=$(docker image inspect "$image" --format '{{range .Config.Env}}{{.}}{{"\n"}}{{end}}')
            echo "Environment Variables:" >> "$report_file"
            echo "$env_vars" >> "$report_file"
            
            # Check for sensitive files
            local sensitive_files=$(docker run --rm "$image" find / -name "*.pem" -o -name "*.key" -o -name "*.crt" 2>/dev/null || echo "none")
            echo "Sensitive Files Found:" >> "$report_file"
            echo "$sensitive_files" >> "$report_file"
            
            log "Best practices check completed for $image"
        else
            warn "Image not found: $image"
        fi
    done
}

# Function to generate security report
generate_security_report() {
    log "Generating security report..."
    
    local report_file="${SCAN_DIR}/security-report-$(date +%Y%m%d_%H%M%S).md"
    
    cat > "$report_file" << EOF
# Security Scan Report - Ever Life Vault

**Scan Date:** $(date)
**Application:** $APP_NAME

## Summary

This report contains the results of security scanning performed on Docker images.

## Scanned Images

- \`${APP_NAME}/backend:latest\`
- \`${APP_NAME}/web:latest\`

## Scan Results

### Vulnerability Scan (Trivy)
- Results stored in: \`trivy-*.json\` and \`trivy-*.html\`
- Severity levels: HIGH, CRITICAL

### Layer Analysis (Dive)
- Results stored in: \`dive-*.txt\`
- Efficiency threshold: 80%

### Best Practices Check
- Results stored in: \`best-practices-*.txt\`
- Checks: user privileges, exposed ports, environment variables, sensitive files

## Recommendations

1. **Regular Scans**: Run this script regularly as part of CI/CD pipeline
2. **Update Base Images**: Keep base images updated to latest versions
3. **Minimize Attack Surface**: Remove unnecessary packages and files
4. **Non-Root Users**: Ensure containers run as non-root users
5. **Secret Management**: Use Docker secrets or environment variables for sensitive data

## Files Generated

$(ls -la "$SCAN_DIR" | grep -E "\.(json|html|txt|md)$" | awk '{print "- " $9}')

## Next Steps

1. Review all scan results
2. Address high and critical vulnerabilities
3. Implement security best practices
4. Schedule regular security scans

---

*Report generated by Ever Life Vault Security Scanner*
EOF
    
    log "Security report generated: $report_file"
}

# Function to cleanup old scans
cleanup_old_scans() {
    log "Cleaning up old scan files..."
    
    # Keep only the last 10 scan reports
    find "$SCAN_DIR" -name "security-report-*.md" -type f | sort -r | tail -n +11 | xargs rm -f || true
    
    # Keep only the last 5 sets of scan results
    find "$SCAN_DIR" -name "trivy-*.json" -type f | sort -r | tail -n +6 | xargs rm -f || true
    find "$SCAN_DIR" -name "trivy-*.html" -type f | sort -r | tail -n +6 | xargs rm -f || true
    find "$SCAN_DIR" -name "dive-*.txt" -type f | sort -r | tail -n +6 | xargs rm -f || true
    find "$SCAN_DIR" -name "best-practices-*.txt" -type f | sort -r | tail -n +6 | xargs rm -f || true
    
    log "Cleanup completed"
}

# Main function
main() {
    log "Starting Docker security scan for $APP_NAME..."
    
    # Check prerequisites
    check_prerequisites
    
    # Create scan directory
    create_scan_directory
    
    # Perform security scans
    scan_with_trivy
    analyze_with_dive
    check_security_best_practices
    
    # Generate report
    generate_security_report
    
    # Cleanup old scans
    cleanup_old_scans
    
    log "Security scan completed successfully!"
    log "Results available in: $SCAN_DIR"
    log "Log file: $LOG_FILE"
    
    echo "=== Security Scan completed at $(date) ===" >> "$LOG_FILE"
}

# Run main function
main "$@"
