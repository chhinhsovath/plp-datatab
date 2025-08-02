#!/bin/bash

# DataTab Deployment Script
# This script handles automated deployment with rollback capabilities

set -e

# Configuration
DEPLOYMENT_ENV=${1:-production}
VERSION=${2:-latest}
ROLLBACK_VERSION=${3}

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Logging function
log() {
  echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

warn() {
  echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING: $1${NC}"
}

error() {
  echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR: $1${NC}"
}

# Pre-deployment checks
pre_deployment_checks() {
  log "Running pre-deployment checks..."
  
  # Check if Docker is running
  if ! docker info > /dev/null 2>&1; then
    error "Docker is not running"
    exit 1
  fi
  
  # Check if required environment variables are set
  if [ -z "$POSTGRES_PASSWORD" ]; then
    error "POSTGRES_PASSWORD environment variable is not set"
    exit 1
  fi
  
  if [ -z "$JWT_SECRET" ]; then
    error "JWT_SECRET environment variable is not set"
    exit 1
  fi
  
  # Check if backup directory exists
  if [ ! -d "/backups" ]; then
    warn "Backup directory does not exist, creating it..."
    mkdir -p /backups
  fi
  
  log "Pre-deployment checks passed"
}

# Create backup before deployment
create_backup() {
  log "Creating backup before deployment..."
  
  if [ -f "./scripts/backup.sh" ]; then
    ./scripts/backup.sh
    log "Backup created successfully"
  else
    warn "Backup script not found, skipping backup"
  fi
}

# Health check function
health_check() {
  local service_url=$1
  local max_attempts=30
  local attempt=1
  
  log "Performing health check for $service_url..."
  
  while [ $attempt -le $max_attempts ]; do
    if curl -f -s "$service_url/health" > /dev/null; then
      log "Health check passed for $service_url"
      return 0
    fi
    
    log "Health check attempt $attempt/$max_attempts failed, retrying in 10 seconds..."
    sleep 10
    attempt=$((attempt + 1))
  done
  
  error "Health check failed for $service_url after $max_attempts attempts"
  return 1
}

# Deploy function
deploy() {
  log "Starting deployment for environment: $DEPLOYMENT_ENV, version: $VERSION"
  
  # Pull latest images
  log "Pulling latest Docker images..."
  docker-compose -f docker-compose.prod.yml pull
  
  # Stop services gracefully
  log "Stopping services gracefully..."
  docker-compose -f docker-compose.prod.yml down --timeout 30
  
  # Start services
  log "Starting services..."
  docker-compose -f docker-compose.prod.yml up -d
  
  # Wait for services to be ready
  log "Waiting for services to be ready..."
  sleep 30
  
  # Run database migrations
  log "Running database migrations..."
  docker-compose -f docker-compose.prod.yml exec -T backend npx prisma migrate deploy
  
  # Perform health checks
  if ! health_check "http://localhost"; then
    error "Frontend health check failed"
    return 1
  fi
  
  if ! health_check "http://localhost:3001"; then
    error "Backend health check failed"
    return 1
  fi
  
  log "Deployment completed successfully"
}

# Rollback function
rollback() {
  local rollback_version=$1
  
  if [ -z "$rollback_version" ]; then
    error "Rollback version not specified"
    exit 1
  fi
  
  log "Starting rollback to version: $rollback_version"
  
  # Stop current services
  log "Stopping current services..."
  docker-compose -f docker-compose.prod.yml down --timeout 30
  
  # Restore from backup
  log "Restoring from backup..."
  if [ -f "./scripts/restore.sh" ]; then
    ./scripts/restore.sh "$rollback_version"
  else
    warn "Restore script not found, manual restoration may be required"
  fi
  
  # Deploy previous version
  log "Deploying previous version..."
  VERSION=$rollback_version deploy
  
  log "Rollback completed successfully"
}

# Blue-green deployment function
blue_green_deploy() {
  log "Starting blue-green deployment..."
  
  # Create new environment
  log "Creating green environment..."
  docker-compose -f docker-compose.prod.yml -p datatab-green up -d
  
  # Wait for green environment to be ready
  sleep 60
  
  # Health check green environment
  if health_check "http://localhost:8080"; then
    log "Green environment is healthy, switching traffic..."
    
    # Switch traffic (this would typically involve load balancer configuration)
    # For now, we'll just stop the blue environment and rename green to production
    docker-compose -f docker-compose.prod.yml -p datatab-blue down
    docker-compose -f docker-compose.prod.yml -p datatab-green down
    docker-compose -f docker-compose.prod.yml up -d
    
    log "Blue-green deployment completed successfully"
  else
    error "Green environment health check failed, keeping blue environment"
    docker-compose -f docker-compose.prod.yml -p datatab-green down
    return 1
  fi
}

# Canary deployment function
canary_deploy() {
  log "Starting canary deployment..."
  
  # Deploy canary version to a subset of instances
  log "Deploying canary version..."
  docker-compose -f docker-compose.prod.yml -p datatab-canary up -d --scale backend=1
  
  # Monitor canary for a period
  log "Monitoring canary deployment for 5 minutes..."
  sleep 300
  
  # Check canary health and metrics
  if health_check "http://localhost:3002"; then
    log "Canary deployment successful, proceeding with full deployment..."
    deploy
    docker-compose -f docker-compose.prod.yml -p datatab-canary down
  else
    error "Canary deployment failed, rolling back..."
    docker-compose -f docker-compose.prod.yml -p datatab-canary down
    return 1
  fi
}

# Main deployment logic
main() {
  case "${1:-deploy}" in
    "deploy")
      pre_deployment_checks
      create_backup
      deploy
      ;;
    "rollback")
      if [ -z "$ROLLBACK_VERSION" ]; then
        error "ROLLBACK_VERSION environment variable must be set for rollback"
        exit 1
      fi
      rollback "$ROLLBACK_VERSION"
      ;;
    "blue-green")
      pre_deployment_checks
      create_backup
      blue_green_deploy
      ;;
    "canary")
      pre_deployment_checks
      create_backup
      canary_deploy
      ;;
    *)
      echo "Usage: $0 [deploy|rollback|blue-green|canary] [version] [rollback_version]"
      echo "Environment variables:"
      echo "  POSTGRES_PASSWORD - Database password"
      echo "  JWT_SECRET - JWT secret key"
      echo "  ROLLBACK_VERSION - Version to rollback to (for rollback command)"
      exit 1
      ;;
  esac
}

# Trap errors and perform cleanup
trap 'error "Deployment failed"; exit 1' ERR

# Run main function
main "$@"