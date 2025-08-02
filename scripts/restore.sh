#!/bin/bash

# DataTab Restore Script
# This script restores backups of the database and uploaded files

set -e

# Configuration
BACKUP_DIR="/backups"
DB_HOST=${DB_HOST:-postgres}
DB_PORT=${DB_PORT:-5432}
DB_NAME=${DB_NAME:-datatab_prod}
DB_USER=${DB_USER:-datatab}
DB_PASSWORD=${POSTGRES_PASSWORD}

# Check if backup file is provided
if [ -z "$1" ]; then
  echo "Usage: $0 <backup_date> [component]"
  echo "Example: $0 20240101_120000"
  echo "Components: database, redis, files, all (default)"
  exit 1
fi

BACKUP_DATE=$1
COMPONENT=${2:-all}

echo "Starting restore process for backup date: $BACKUP_DATE"

# Function to restore database
restore_database() {
  local backup_file="$BACKUP_DIR/database_backup_$BACKUP_DATE.dump.gz"
  
  if [ ! -f "$backup_file" ]; then
    echo "Database backup file not found: $backup_file"
    return 1
  fi
  
  echo "Restoring database from $backup_file..."
  
  # Create a temporary uncompressed file
  gunzip -c "$backup_file" > "/tmp/database_backup_$BACKUP_DATE.dump"
  
  # Drop existing database and recreate
  PGPASSWORD="$DB_PASSWORD" dropdb -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" "$DB_NAME" --if-exists
  PGPASSWORD="$DB_PASSWORD" createdb -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" "$DB_NAME"
  
  # Restore database
  PGPASSWORD="$DB_PASSWORD" pg_restore \
    -h "$DB_HOST" \
    -p "$DB_PORT" \
    -U "$DB_USER" \
    -d "$DB_NAME" \
    --verbose \
    --no-owner \
    --no-privileges \
    "/tmp/database_backup_$BACKUP_DATE.dump"
  
  # Cleanup temporary file
  rm "/tmp/database_backup_$BACKUP_DATE.dump"
  
  echo "Database restore completed"
}

# Function to restore Redis
restore_redis() {
  local backup_file="$BACKUP_DIR/redis_backup_$BACKUP_DATE.rdb.gz"
  
  if [ ! -f "$backup_file" ]; then
    echo "Redis backup file not found: $backup_file"
    return 1
  fi
  
  echo "Restoring Redis from $backup_file..."
  
  # Stop Redis service
  docker-compose -f docker-compose.prod.yml stop redis
  
  # Extract backup file
  gunzip -c "$backup_file" > "/tmp/dump.rdb"
  
  # Copy to Redis data directory
  docker cp "/tmp/dump.rdb" "$(docker-compose -f docker-compose.prod.yml ps -q redis):/data/dump.rdb"
  
  # Start Redis service
  docker-compose -f docker-compose.prod.yml start redis
  
  # Cleanup temporary file
  rm "/tmp/dump.rdb"
  
  echo "Redis restore completed"
}

# Function to restore files
restore_files() {
  local backup_file="$BACKUP_DIR/files_backup_$BACKUP_DATE.tar.gz"
  
  if [ ! -f "$backup_file" ]; then
    echo "Files backup file not found: $backup_file"
    return 1
  fi
  
  echo "Restoring files from $backup_file..."
  
  # Create uploads directory if it doesn't exist
  mkdir -p /app/uploads
  
  # Extract files
  tar -xzf "$backup_file" -C /app/
  
  echo "Files restore completed"
}

# Function to restore configuration
restore_config() {
  local backup_file="$BACKUP_DIR/config_backup_$BACKUP_DATE.tar.gz"
  
  if [ ! -f "$backup_file" ]; then
    echo "Configuration backup file not found: $backup_file"
    return 1
  fi
  
  echo "Restoring configuration from $backup_file..."
  
  # Extract configuration files
  tar -xzf "$backup_file" -C /
  
  echo "Configuration restore completed"
}

# Perform restore based on component
case $COMPONENT in
  "database")
    restore_database
    ;;
  "redis")
    restore_redis
    ;;
  "files")
    restore_files
    ;;
  "config")
    restore_config
    ;;
  "all")
    restore_database
    restore_redis
    restore_files
    restore_config
    ;;
  *)
    echo "Unknown component: $COMPONENT"
    echo "Valid components: database, redis, files, config, all"
    exit 1
    ;;
esac

echo "Restore process completed at $(date)"

# Run database migrations if database was restored
if [ "$COMPONENT" = "database" ] || [ "$COMPONENT" = "all" ]; then
  echo "Running database migrations..."
  docker-compose -f docker-compose.prod.yml exec backend npx prisma migrate deploy
  echo "Database migrations completed"
fi