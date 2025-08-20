#!/bin/bash

set -e

ENVIRONMENT=${1:-production}
PROJECT_DIR=$(pwd)

echo "🚀 Starting deployment for $ENVIRONMENT environment..."

# Create necessary directories
mkdir -p data/{postgres,logs,certbot} ssl backups

# Backup database (production only)
if [ "$ENVIRONMENT" = "production" ]; then
    echo "📦 Creating database backup..."
    if docker-compose -f docker-compose.prod.yml ps | grep -q inka-postgres-prod; then
        docker-compose -f docker-compose.prod.yml exec -T postgres-prod pg_dump -U ${POSTGRES_USER:-inka_user} ${POSTGRES_DB:-inka_prod} > "backups/backup-$(date +%Y%m%d-%H%M%S).sql" || echo "Backup failed - continuing deployment"
    fi
fi

# Pull latest code if this is an update
if [ -d ".git" ]; then
    echo "📥 Pulling latest code..."
    git pull origin main || echo "Git pull failed - continuing with current code"
fi

# Build and deploy
if [ "$ENVIRONMENT" = "production" ]; then
    echo "🏗️ Building production environment..."
    
    # Check if .env.production exists
    if [ ! -f ".env.production" ]; then
        echo "Creating .env.production template..."
        cat > .env.production << EOF
# Database
POSTGRES_DB=inka_prod
POSTGRES_USER=inka_user
POSTGRES_PASSWORD=change-this-password
DATABASE_URL=postgresql://inka_user:change-this-password@postgres-prod:5432/inka_prod

# Redis
REDIS_PASSWORD=change-this-redis-password

# Application
NODE_ENV=production
PORT=5000
JWT_SECRET=change-this-jwt-secret

# ElevenLabs API
ELEVENLABS_API_KEY=your-elevenlabs-api-key

# Domain
DOMAIN=your-domain.com
EMAIL=your-email@domain.com
EOF
        echo "⚠️  Please edit .env.production with your actual values before running again!"
        exit 1
    fi
    
    cp .env.production .env
    docker-compose -f docker-compose.prod.yml down || true
    docker-compose -f docker-compose.prod.yml build --no-cache
    docker-compose -f docker-compose.prod.yml up -d
else
    echo "🏗️ Building development environment..."
    
    # Check if .env.development exists
    if [ ! -f ".env.development" ]; then
        echo "Creating .env.development template..."
        cat > .env.development << EOF
# Database
DATABASE_URL=postgresql://inka_user:inka_password_dev@postgres-dev:5432/inka_dev

# Application
NODE_ENV=development
PORT=5000
JWT_SECRET=dev-jwt-secret-key

# ElevenLabs API
ELEVENLABS_API_KEY=your-elevenlabs-api-key
EOF
        echo "⚠️  Please edit .env.development with your actual values before running again!"
        exit 1
    fi
    
    cp .env.development .env
    docker-compose -f docker-compose.dev.yml down || true
    docker-compose -f docker-compose.dev.yml build --no-cache
    docker-compose -f docker-compose.dev.yml up -d
fi

# Wait for services to be ready
echo "⏳ Waiting for services to start..."
sleep 30

# Health check
echo "🔍 Performing health check..."
if [ "$ENVIRONMENT" = "production" ]; then
    if curl -f http://localhost:5000/api/health 2>/dev/null; then
        echo "✅ Production deployment successful!"
    else
        echo "❌ Health check failed! Checking logs..."
        docker-compose -f docker-compose.prod.yml logs app-prod
        exit 1
    fi
else
    if curl -f http://localhost:5000/api/health 2>/dev/null; then
        echo "✅ Development deployment successful!"
        echo "📡 Frontend available at: http://localhost:5000"
        echo "🔧 Backend API at: http://localhost:5000/api"
        echo "🗄️  Database at: localhost:5432"
    else
        echo "❌ Health check failed! Checking logs..."
        docker-compose -f docker-compose.dev.yml logs app-dev
        exit 1
    fi
fi

echo "🎉 Deployment completed successfully!"

# Show running services
echo "📊 Running services:"
if [ "$ENVIRONMENT" = "production" ]; then
    docker-compose -f docker-compose.prod.yml ps
else
    docker-compose -f docker-compose.dev.yml ps
fi