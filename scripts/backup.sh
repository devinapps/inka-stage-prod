#!/bin/bash

BACKUP_DIR="./backups"
DATE=$(date +%Y%m%d-%H%M%S)

mkdir -p $BACKUP_DIR

echo "📦 Creating backup: backup-$DATE"

# Load environment variables
if [ -f ".env" ]; then
    export $(cat .env | grep -v '^#' | xargs)
fi

# Database backup
if docker-compose -f docker-compose.prod.yml ps | grep -q inka-postgres-prod; then
    echo "🗄️  Backing up database..."
    docker-compose -f docker-compose.prod.yml exec -T postgres-prod pg_dump -U ${POSTGRES_USER:-inka_user} ${POSTGRES_DB:-inka_prod} > "$BACKUP_DIR/db-backup-$DATE.sql"
    
    if [ $? -eq 0 ]; then
        echo "✅ Database backup completed: db-backup-$DATE.sql"
        
        # Compress database backup
        gzip "$BACKUP_DIR/db-backup-$DATE.sql"
        echo "🗜️  Database backup compressed: db-backup-$DATE.sql.gz"
    else
        echo "❌ Database backup failed!"
    fi
else
    echo "⚠️  Database container not running, skipping database backup"
fi

# Code backup (excluding unnecessary files)
echo "📂 Backing up application code..."
tar -czf "$BACKUP_DIR/code-backup-$DATE.tar.gz" \
    --exclude=node_modules \
    --exclude=data \
    --exclude=.git \
    --exclude=dist \
    --exclude=backups \
    --exclude=ssl \
    .

if [ $? -eq 0 ]; then
    echo "✅ Code backup completed: code-backup-$DATE.tar.gz"
else
    echo "❌ Code backup failed!"
fi

# SSL certificates backup
if [ -d "ssl" ] && [ "$(ls -A ssl)" ]; then
    echo "🔐 Backing up SSL certificates..."
    tar -czf "$BACKUP_DIR/ssl-backup-$DATE.tar.gz" ssl/
    echo "✅ SSL backup completed: ssl-backup-$DATE.tar.gz"
fi

# Clean old backups (keep last 7 days)
echo "🧹 Cleaning old backups..."
find $BACKUP_DIR -name "*.sql.gz" -mtime +7 -delete
find $BACKUP_DIR -name "*.tar.gz" -mtime +7 -delete

# Show backup summary
echo "📊 Backup Summary:"
echo "==================="
ls -lah $BACKUP_DIR/*$DATE*

echo "✅ Backup completed successfully!"
echo "📁 Backup location: $BACKUP_DIR"