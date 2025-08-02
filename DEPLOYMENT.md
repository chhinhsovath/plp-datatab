# DataTab Deployment Guide

This guide covers the deployment and monitoring infrastructure for the DataTab application.

## Prerequisites

- Docker and Docker Compose
- Node.js 18+ (for local development)
- PostgreSQL 15+
- Redis 7+
- Git

## Environment Variables

Create a `.env` file with the following variables:

```bash
# Database
POSTGRES_PASSWORD=your_secure_password
DATABASE_URL=postgresql://datatab:${POSTGRES_PASSWORD}@postgres:5432/datatab_prod

# Redis
REDIS_PASSWORD=your_redis_password
REDIS_URL=redis://redis:6379

# Authentication
JWT_SECRET=your_jwt_secret_key
ENCRYPTION_KEY=your_32_character_encryption_key

# Monitoring
GRAFANA_PASSWORD=your_grafana_password

# Alerts
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USERNAME=alerts@yourdomain.com
SMTP_PASSWORD=your_smtp_password
SMTP_FROM=alerts@yourdomain.com
ALERT_EMAIL_TO=admin@yourdomain.com,team@yourdomain.com

SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK
SLACK_CHANNEL=#alerts

# AWS (for backups)
AWS_REGION=us-east-1
S3_BACKUP_BUCKET=datatab-backups
```

## Production Deployment

### 1. Using Docker Compose

```bash
# Clone the repository
git clone <repository-url>
cd datatab-clone

# Set up environment variables
cp .env.example .env
# Edit .env with your values

# Deploy the application
docker-compose -f docker-compose.prod.yml up -d

# Check deployment status
docker-compose -f docker-compose.prod.yml ps
```

### 2. Using Deployment Script

```bash
# Make scripts executable
chmod +x scripts/*.sh

# Deploy with automated checks
./scripts/deploy.sh deploy

# Deploy with blue-green strategy
./scripts/deploy.sh blue-green

# Deploy with canary strategy
./scripts/deploy.sh canary
```

### 3. Vercel Deployment

```bash
# Install Vercel CLI
npm install -g vercel

# Set environment variables in Vercel dashboard
# Deploy
vercel --prod
```

## Monitoring Setup

### 1. Prometheus + Grafana

The monitoring stack is included in the production Docker Compose file:

- **Prometheus**: http://localhost:9090
- **Grafana**: http://localhost:3000 (admin/your_grafana_password)
- **Node Exporter**: http://localhost:9100

### 2. Log Aggregation (ELK Stack)

```bash
# Start logging infrastructure
docker-compose -f docker-compose.logging.yml up -d

# Access Kibana
open http://localhost:5601
```

### 3. Application Performance Monitoring

APM metrics are available at:
- `/health/metrics` - Prometheus format
- `/health/detailed` - Detailed health information
- `/health` - Basic health check

## Backup and Recovery

### Automated Backups

```bash
# Run backup manually
./scripts/backup.sh

# Set up automated backups (cron)
# Add to crontab:
0 2 * * * /path/to/scripts/backup.sh
```

### Restore from Backup

```bash
# List available backups
ls -la /backups/

# Restore specific backup
./scripts/restore.sh 20240101_120000

# Restore specific component
./scripts/restore.sh 20240101_120000 database
```

## Health Checks

### Application Health

```bash
# Basic health check
curl http://localhost/health

# Detailed health check
curl http://localhost/health/detailed

# Prometheus metrics
curl http://localhost/health/metrics
```

### Service Health

```bash
# Check all services
docker-compose -f docker-compose.prod.yml ps

# Check logs
docker-compose -f docker-compose.prod.yml logs -f backend
docker-compose -f docker-compose.prod.yml logs -f frontend
```

## Scaling

### Horizontal Scaling

```bash
# Scale backend instances
docker-compose -f docker-compose.prod.yml up -d --scale backend=3

# Scale with load balancer
# Update nginx.conf to include upstream configuration
```

### Database Scaling

```bash
# Add read replicas
# Update docker-compose.prod.yml with read replica configuration
```

## Security

### SSL/TLS Setup

```bash
# Using Let's Encrypt with Certbot
sudo certbot --nginx -d yourdomain.com

# Or use your own certificates
# Update nginx.conf with SSL configuration
```

### Security Monitoring

Security events are logged and can be monitored through:
- Application logs
- Grafana dashboards
- Alert notifications

## Troubleshooting

### Common Issues

1. **Database Connection Issues**
   ```bash
   # Check database logs
   docker-compose -f docker-compose.prod.yml logs postgres
   
   # Test connection
   docker-compose -f docker-compose.prod.yml exec backend npx prisma db push
   ```

2. **Redis Connection Issues**
   ```bash
   # Check Redis logs
   docker-compose -f docker-compose.prod.yml logs redis
   
   # Test Redis connection
   docker-compose -f docker-compose.prod.yml exec redis redis-cli ping
   ```

3. **High Memory Usage**
   ```bash
   # Check memory usage
   docker stats
   
   # Restart services if needed
   docker-compose -f docker-compose.prod.yml restart
   ```

### Log Analysis

```bash
# View application logs
tail -f logs/combined.log

# View error logs
tail -f logs/error.log

# Search logs
grep "ERROR" logs/combined.log
```

## Rollback Procedures

### Automatic Rollback

```bash
# Rollback to previous version
ROLLBACK_VERSION=20240101_120000 ./scripts/deploy.sh rollback
```

### Manual Rollback

```bash
# Stop current services
docker-compose -f docker-compose.prod.yml down

# Restore from backup
./scripts/restore.sh 20240101_120000

# Start services
docker-compose -f docker-compose.prod.yml up -d
```

## Performance Optimization

### Database Optimization

```sql
-- Add indexes for frequently queried columns
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_datasets_user_id ON datasets(user_id);
CREATE INDEX idx_analyses_dataset_id ON analyses(dataset_id);
```

### Redis Optimization

```bash
# Configure Redis memory policy
redis-cli CONFIG SET maxmemory-policy allkeys-lru
```

### Application Optimization

- Enable gzip compression (configured in nginx.conf)
- Use CDN for static assets
- Implement caching strategies
- Optimize database queries

## Monitoring Alerts

### Critical Alerts

- Service down
- Database connection failed
- High error rate (>10%)
- High memory usage (>90%)

### Warning Alerts

- High response time (>2s)
- Elevated memory usage (>80%)
- High CPU usage (>80%)

## Maintenance

### Regular Tasks

1. **Daily**
   - Check application health
   - Review error logs
   - Monitor resource usage

2. **Weekly**
   - Review backup integrity
   - Update security patches
   - Analyze performance metrics

3. **Monthly**
   - Database maintenance
   - Log rotation
   - Security audit

### Updates

```bash
# Update application
git pull origin main
./scripts/deploy.sh deploy

# Update dependencies
docker-compose -f docker-compose.prod.yml pull
docker-compose -f docker-compose.prod.yml up -d
```

## Support

For deployment issues:
1. Check application logs
2. Verify environment variables
3. Test database and Redis connections
4. Review monitoring dashboards
5. Contact the development team

## Security Considerations

- Keep all dependencies updated
- Use strong passwords and secrets
- Enable HTTPS in production
- Regularly backup data
- Monitor for security threats
- Implement proper access controls
- Use environment variables for sensitive data