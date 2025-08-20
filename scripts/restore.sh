#!/bin/bash

BACKUP_FILE=$1

if [ -z "$BACKUP_FILE" ]; then
    echo "Usage: $0 <backup-file>"
    echo "Available backups:"
    ls -la backups/
    exit 1
fi

if [ ! -f "$BACKUP_FILE" ]; then
    echo "❌ Backup file not found: $BACKUP_FILE"
    exit 1
fi

echo "🔄 Restoring from backup: $BACKUP_FILE"

# Load environment variables
if [ -f ".env" ]; then
    export $(cat .env | grep -v '^#' | xargs)
fi

# Determine backup type
if [[ "$BACKUP_FILE" == *"db-backup"* ]]; then
    echo "🗄️  Restoring database backup..."
    
    # Check if it's compressed
    if [[ "$BACKUP_FILE" == *.gz ]]; then
        echo "📂 Decompressing backup..."
        gunzip -c "$BACKUP_FILE" | docker-compose -f docker-compose.prod.yml exec -T postgres-prod psql -U ${POSTGRES_USER:-inka_user} -d ${POSTGRES_DB:-inka_prod}
    else
        docker-compose -f docker-compose.prod.yml exec -T postgres-prod psql -U ${POSTGRES_USER:-inka_user} -d ${POSTGRES_DB:-inka_prod} < "$BACKUP_FILE"
    fi
    
    if [ $? -eq 0 ]; then
        echo "✅ Database restored successfully!"
    else
        echo "❌ Database restore failed!"
        exit 1
    fi

elif [[ "$BACKUP_FILE" == *"code-backup"* ]]; then
    echo "📂 Restoring code backup..."
    
    # Create backup of current code
    echo "📦 Creating backup of current code..."
    tar -czf "backups/current-code-backup-$(date +%Y%m%d-%H%M%S).tar.gz" \
        --exclude=node_modules \
        --exclude=data \
        --exclude=.git \
        --exclude=dist \
        --exclude=backups \
        --exclude=ssl \
        .
    
    # Extract backup
    tar -xzf "$BACKUP_FILE"
    
    if [ $? -eq 0 ]; then
        echo "✅ Code restored successfully!"
        echo "🔄 Rebuilding application..."
        ./scripts/deploy.sh production
    else
        echo "❌ Code restore failed!"
        exit 1
    fi

elif [[ "$BACKUP_FILE" == *"ssl-backup"* ]]; then
    echo "🔐 Restoring SSL certificates..."
    
    # Backup current SSL
    if [ -d "ssl" ]; then
        mv ssl ssl-backup-$(date +%Y%m%d-%H%M%S)
    fi
    
    # Extract SSL backup
    tar -xzf "$BACKUP_FILE"
    
    if [ $? -eq 0 ]; then
        echo "✅ SSL certificates restored successfully!"
        echo "🔄 Reloading nginx..."
        docker-compose -f docker-compose.prod.yml exec nginx nginx -s reload
    else
        echo "❌ SSL restore failed!"
        exit 1
    fi

else
    echo "❌ Unknown backup type: $BACKUP_FILE"
    echo "Supported types: db-backup, code-backup, ssl-backup"
    exit 1
fi

echo "🎉 Restore completed successfully!"