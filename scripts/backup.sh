#!/bin/bash

# DataTab Backup Script
# This script creates backups of the database and uploaded files

set -e

# Configuration
BACKUP_DIR="/backups"
DATE=$(date +%Y%m%d_%H%M%S)
RETENTION_DAYS=30

# Database configuration
DB_HOST=${DB_HOST:-postgres}
DB_PORT=${DB_PORT:-5432}
DB_NAME=${DB_NAME:-datatab_prod}
DB_USER=${DB_USER:-datatab}
DB_PASSWORD=${POSTGRES_PASSWORD}

# S3 configuration for remote backups
S3_BUCKET=${S3_BACKUP_BUCKET}
AWS_REGION=${AWS_REGION:-us-east-1}

# Create backup directory
mkdir -p "$BACKUP_DIR"

echo "Starting backup process at $(date)"

# 1. Database backup
echo "Creating database backup..."
PGPASSWORD="$DB_PASSWORD" pg_dump \
  -h "$DB_HOST" \
  -p "$DB_PORT" \
  -U "$DB_USER" \
  -d "$DB_NAME" \
  --verbose \
  --no-owner \
  --no-privileges \
  --format=custom \
  > "$BACKUP_DIR/database_backup_$DATE.dump"

# Compress database backup
gzip "$BACKUP_DIR/database_backup_$DATE.dump"

echo "Database backup completed: database_backup_$DATE.dump.gz"

# 2. Redis backup
echo "Creating Redis backup..."
if command -v redis-cli &> /dev/null; then
  redis-cli --rdb "$BACKUP_DIR/redis_backup_$DATE.rdb"
  gzip "$BACKUP_DIR/redis_backup_$DATE.rdb"
  echo "Redis backup completed: redis_backup_$DATE.rdb.gz"
fi

# 3. Application files backup (if using local storage)
if [ -d "/app/uploads" ]; then
  echo "Creating application files backup..."
  tar -czf "$BACKUP_DIR/files_backup_$DATE.tar.gz" -C /app uploads/
  echo "Files backup completed: files_backup_$DATE.tar.gz"
fi

# 4. Configuration backup
echo "Creating configuration backup..."
tar -czf "$BACKUP_DIR/config_backup_$DATE.tar.gz" \
  docker-compose.prod.yml \
  nginx.conf \
  monitoring/ \
  scripts/ 2>/dev/null || true

echo "Configuration backup completed: config_backup_$DATE.tar.gz"

# 5. Upload to S3 if configured
if [ -n "$S3_BUCKET" ]; then
  echo "Uploading backups to S3..."
  aws s3 sync "$BACKUP_DIR" "s3://$S3_BUCKET/backups/$(date +%Y/%m/%d)/" \
    --region "$AWS_REGION" \
    --exclude "*" \
    --include "*_$DATE.*"
  echo "S3 upload completed"
fi

# 6. Cleanup old backups
echo "Cleaning up old backups..."
find "$BACKUP_DIR" -name "*.gz" -mtime +$RETENTION_DAYS -delete
find "$BACKUP_DIR" -name "*.dump" -mtime +$RETENTION_DAYS -delete
find "$BACKUP_DIR" -name "*.rdb" -mtime +$RETENTION_DAYS -delete

echo "Backup process completed at $(date)"

# 7. Verify backup integrity
echo "Verifying backup integrity..."
if [ -f "$BACKUP_DIR/database_backup_$DATE.dump.gz" ]; then
  gunzip -t "$BACKUP_DIR/database_backup_$DATE.dump.gz"
  echo "Database backup integrity verified"
fi

if [ -f "$BACKUP_DIR/redis_backup_$DATE.rdb.gz" ]; then
  gunzip -t "$BACKUP_DIR/redis_backup_$DATE.rdb.gz"
  echo "Redis backup integrity verified"
fi

echo "Backup verification completed"