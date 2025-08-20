# Inka AI Assistant - Deployment Guide

## Tổng quan
Hướng dẫn đầy đủ để setup và deploy ứng dụng Inka AI Assistant trên VPS sử dụng Docker Compose cho cả môi trường development và production.

## Kiến trúc hệ thống
- **Frontend**: React + TypeScript + Vite
- **Backend**: Express.js + TypeScript 
- **Database**: PostgreSQL
- **Voice AI**: ElevenLabs API
- **Container**: Docker + Docker Compose
- **Reverse Proxy**: Nginx
- **SSL**: Let's Encrypt

---

## 1. Yêu cầu hệ thống

### VPS Requirements
- **CPU**: Tối thiểu 2 cores
- **RAM**: Tối thiểu 4GB (khuyến nghị 8GB)
- **Storage**: Tối thiểu 20GB SSD
- **OS**: Ubuntu 20.04+ hoặc CentOS 8+
- **Network**: Port 80, 443, 22 mở

### Software Requirements
- Docker 20.10+
- Docker Compose 2.0+
- Git
- Domain name (cho production)

---

## 2. Cài đặt môi trường cơ bản

### 2.1 Cập nhật hệ thống
```bash
# Ubuntu/Debian
sudo apt update && sudo apt upgrade -y

# CentOS/RHEL
sudo yum update -y
```

### 2.2 Cài đặt Docker
```bash
# Ubuntu/Debian
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER

# Khởi động Docker
sudo systemctl enable docker
sudo systemctl start docker
```

### 2.3 Cài đặt Docker Compose
```bash
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose
```

### 2.4 Cài đặt Git và các công cụ cần thiết
```bash
sudo apt install -y git curl wget nano htop
```

---

## 3. Clone và setup project

### 3.1 Clone repository
```bash
cd /opt
sudo git clone https://github.com/your-username/inka-ai-assistant.git
sudo chown -R $USER:$USER inka-ai-assistant
cd inka-ai-assistant
```

### 3.2 Tạo cấu trúc thư mục
```bash
mkdir -p docker/{development,production,nginx}
mkdir -p data/{postgres,logs}
mkdir -p ssl
```

---

## 4. Môi trường Development

### 4.1 Tạo Dockerfile cho Development

**docker/development/Dockerfile**
```dockerfile
# Frontend Development
FROM node:18-alpine as frontend-dev

WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .

EXPOSE 5173
CMD ["npm", "run", "dev"]

# Backend Development  
FROM node:18-alpine as backend-dev

WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .

EXPOSE 5000
CMD ["npm", "run", "dev:server"]
```

### 4.2 Docker Compose cho Development

**docker-compose.dev.yml**
```yaml
version: '3.8'

services:
  # PostgreSQL Database
  postgres-dev:
    image: postgres:15-alpine
    container_name: inka-postgres-dev
    environment:
      POSTGRES_DB: inka_dev
      POSTGRES_USER: inka_user
      POSTGRES_PASSWORD: inka_password_dev
      POSTGRES_HOST_AUTH_METHOD: trust
    ports:
      - "5432:5432"
    volumes:
      - ./data/postgres-dev:/var/lib/postgresql/data
      - ./docker/postgres/init.sql:/docker-entrypoint-initdb.d/init.sql
    networks:
      - inka-network
    restart: unless-stopped

  # Redis Cache (Optional)
  redis-dev:
    image: redis:7-alpine
    container_name: inka-redis-dev
    ports:
      - "6379:6379"
    volumes:
      - ./data/redis-dev:/data
    networks:
      - inka-network
    restart: unless-stopped

  # Backend Service
  backend-dev:
    build:
      context: .
      dockerfile: docker/development/Dockerfile
      target: backend-dev
    container_name: inka-backend-dev
    environment:
      - NODE_ENV=development
      - DATABASE_URL=postgresql://inka_user:inka_password_dev@postgres-dev:5432/inka_dev
      - ELEVENLABS_API_KEY=${ELEVENLABS_API_KEY}
      - JWT_SECRET=${JWT_SECRET}
      - PORT=5000
    ports:
      - "5000:5000"
    volumes:
      - .:/app
      - /app/node_modules
    depends_on:
      - postgres-dev
    networks:
      - inka-network
    restart: unless-stopped

  # Frontend Service
  frontend-dev:
    build:
      context: .
      dockerfile: docker/development/Dockerfile
      target: frontend-dev
    container_name: inka-frontend-dev
    environment:
      - VITE_API_URL=http://localhost:5000
    ports:
      - "5173:5173"
    volumes:
      - .:/app
      - /app/node_modules
    depends_on:
      - backend-dev
    networks:
      - inka-network
    restart: unless-stopped

networks:
  inka-network:
    driver: bridge

volumes:
  postgres-dev-data:
  redis-dev-data:
```

### 4.3 Environment file cho Development

**.env.development**
```bash
# Database
DATABASE_URL=postgresql://inka_user:inka_password_dev@localhost:5432/inka_dev
PGHOST=postgres-dev
PGPORT=5432
PGUSER=inka_user
PGPASSWORD=inka_password_dev
PGDATABASE=inka_dev

# Application
NODE_ENV=development
PORT=5000
JWT_SECRET=your-jwt-secret-key-dev

# ElevenLabs API
ELEVENLABS_API_KEY=your-elevenlabs-api-key

# Frontend
VITE_API_URL=http://localhost:5000
```

### 4.4 Chạy Development Environment
```bash
# Copy environment file
cp .env.development .env

# Build và chạy services
docker-compose -f docker-compose.dev.yml up --build -d

# Xem logs
docker-compose -f docker-compose.dev.yml logs -f

# Dừng services
docker-compose -f docker-compose.dev.yml down
```

---

## 5. Môi trường Production

### 5.1 Tạo Dockerfile cho Production

**docker/production/Dockerfile**
```dockerfile
# Multi-stage build for production

# Stage 1: Build Frontend
FROM node:18-alpine as frontend-builder

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build

# Stage 2: Build Backend
FROM node:18-alpine as backend-builder

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build:server

# Stage 3: Production Runtime
FROM node:18-alpine as production

WORKDIR /app

# Install production dependencies
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# Copy built applications
COPY --from=frontend-builder /app/dist ./dist/public
COPY --from=backend-builder /app/dist ./dist
COPY --from=backend-builder /app/node_modules ./node_modules

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001
USER nodejs

EXPOSE 5000

CMD ["node", "dist/index.js"]
```

### 5.2 Nginx Configuration

**docker/nginx/nginx.conf**
```nginx
upstream inka-backend {
    server backend-prod:5000;
}

# HTTP redirect to HTTPS
server {
    listen 80;
    server_name your-domain.com www.your-domain.com;
    
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }
    
    location / {
        return 301 https://$server_name$request_uri;
    }
}

# HTTPS server
server {
    listen 443 ssl http2;
    server_name your-domain.com www.your-domain.com;

    # SSL Configuration
    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;
    
    ssl_session_timeout 1d;
    ssl_session_cache shared:SSL:50m;
    ssl_session_tickets off;
    
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512:ECDHE-RSA-AES256-GCM-SHA384:DHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    
    # Security headers
    add_header Strict-Transport-Security "max-age=63072000" always;
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types text/plain text/css text/xml text/javascript application/javascript application/xml+rss application/json;

    # Static files
    location / {
        try_files $uri $uri/ @backend;
        root /usr/share/nginx/html;
        index index.html;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # API routes
    location /api {
        proxy_pass http://inka-backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
    }

    # WebSocket support for ElevenLabs
    location /ws {
        proxy_pass http://inka-backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Fallback to backend
    location @backend {
        proxy_pass http://inka-backend;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### 5.3 Docker Compose cho Production

**docker-compose.prod.yml**
```yaml
version: '3.8'

services:
  # PostgreSQL Database
  postgres-prod:
    image: postgres:15-alpine
    container_name: inka-postgres-prod
    environment:
      POSTGRES_DB: ${POSTGRES_DB}
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    volumes:
      - postgres-prod-data:/var/lib/postgresql/data
      - ./backups:/backups
    networks:
      - inka-network
    restart: unless-stopped
    command: postgres -c max_connections=200 -c shared_buffers=256MB -c effective_cache_size=1GB

  # Redis Cache
  redis-prod:
    image: redis:7-alpine
    container_name: inka-redis-prod
    command: redis-server --appendonly yes --requirepass ${REDIS_PASSWORD}
    volumes:
      - redis-prod-data:/data
    networks:
      - inka-network
    restart: unless-stopped

  # Application Server
  backend-prod:
    build:
      context: .
      dockerfile: docker/production/Dockerfile
    container_name: inka-backend-prod
    environment:
      - NODE_ENV=production
      - DATABASE_URL=${DATABASE_URL}
      - ELEVENLABS_API_KEY=${ELEVENLABS_API_KEY}
      - JWT_SECRET=${JWT_SECRET}
      - REDIS_URL=redis://:${REDIS_PASSWORD}@redis-prod:6379
      - PORT=5000
    volumes:
      - ./data/logs:/app/logs
    depends_on:
      - postgres-prod
      - redis-prod
    networks:
      - inka-network
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:5000/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  # Nginx Reverse Proxy
  nginx:
    image: nginx:alpine
    container_name: inka-nginx
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./docker/nginx/nginx.conf:/etc/nginx/conf.d/default.conf
      - ./ssl:/etc/letsencrypt
      - ./data/certbot:/var/www/certbot
      - nginx-logs:/var/log/nginx
    depends_on:
      - backend-prod
    networks:
      - inka-network
    restart: unless-stopped

  # SSL Certificate Management
  certbot:
    image: certbot/certbot
    container_name: inka-certbot
    volumes:
      - ./ssl:/etc/letsencrypt
      - ./data/certbot:/var/www/certbot
    command: certonly --webroot --webroot-path=/var/www/certbot --email your-email@domain.com --agree-tos --no-eff-email -d your-domain.com -d www.your-domain.com
    networks:
      - inka-network

networks:
  inka-network:
    driver: bridge

volumes:
  postgres-prod-data:
  redis-prod-data:
  nginx-logs:
```

### 5.4 Environment file cho Production

**.env.production**
```bash
# Database
POSTGRES_DB=inka_prod
POSTGRES_USER=inka_user
POSTGRES_PASSWORD=super-secure-password-here
DATABASE_URL=postgresql://inka_user:super-secure-password-here@postgres-prod:5432/inka_prod

# Redis
REDIS_PASSWORD=super-secure-redis-password

# Application
NODE_ENV=production
PORT=5000
JWT_SECRET=super-secure-jwt-secret-key-production

# ElevenLabs API
ELEVENLABS_API_KEY=your-production-elevenlabs-api-key

# Domain
DOMAIN=your-domain.com
EMAIL=your-email@domain.com
```

---

## 6. Deployment Scripts

### 6.1 Deployment Script

**scripts/deploy.sh**
```bash
#!/bin/bash

set -e

ENVIRONMENT=${1:-production}
PROJECT_DIR="/opt/inka-ai-assistant"

echo "🚀 Starting deployment for $ENVIRONMENT environment..."

cd $PROJECT_DIR

# Backup database (production only)
if [ "$ENVIRONMENT" = "production" ]; then
    echo "📦 Creating database backup..."
    docker-compose -f docker-compose.prod.yml exec -T postgres-prod pg_dump -U $POSTGRES_USER $POSTGRES_DB > "backups/backup-$(date +%Y%m%d-%H%M%S).sql"
fi

# Pull latest code
echo "📥 Pulling latest code..."
git pull origin main

# Build and deploy
if [ "$ENVIRONMENT" = "production" ]; then
    echo "🏗️ Building production environment..."
    cp .env.production .env
    docker-compose -f docker-compose.prod.yml down
    docker-compose -f docker-compose.prod.yml build --no-cache
    docker-compose -f docker-compose.prod.yml up -d
else
    echo "🏗️ Building development environment..."
    cp .env.development .env
    docker-compose -f docker-compose.dev.yml down
    docker-compose -f docker-compose.dev.yml build --no-cache
    docker-compose -f docker-compose.dev.yml up -d
fi

# Wait for services to be ready
echo "⏳ Waiting for services to start..."
sleep 30

# Health check
echo "🔍 Performing health check..."
if [ "$ENVIRONMENT" = "production" ]; then
    if curl -f http://localhost:5000/health; then
        echo "✅ Deployment successful!"
    else
        echo "❌ Health check failed!"
        exit 1
    fi
else
    if curl -f http://localhost:5000/api/health; then
        echo "✅ Development deployment successful!"
    else
        echo "❌ Health check failed!"
        exit 1
    fi
fi

echo "🎉 Deployment completed successfully!"
```

### 6.2 SSL Setup Script

**scripts/setup-ssl.sh**
```bash
#!/bin/bash

DOMAIN=${1:-your-domain.com}
EMAIL=${2:-your-email@domain.com}

echo "🔒 Setting up SSL for domain: $DOMAIN"

# Initial certificate request
docker-compose -f docker-compose.prod.yml run --rm certbot certonly \
    --webroot \
    --webroot-path=/var/www/certbot \
    --email $EMAIL \
    --agree-tos \
    --no-eff-email \
    -d $DOMAIN \
    -d www.$DOMAIN

# Reload nginx to use new certificates
docker-compose -f docker-compose.prod.yml exec nginx nginx -s reload

echo "✅ SSL setup completed!"
```

### 6.3 Database Migration Script

**scripts/migrate.sh**
```bash
#!/bin/bash

ENVIRONMENT=${1:-production}

if [ "$ENVIRONMENT" = "production" ]; then
    COMPOSE_FILE="docker-compose.prod.yml"
    SERVICE="backend-prod"
else
    COMPOSE_FILE="docker-compose.dev.yml"
    SERVICE="backend-dev"
fi

echo "🗄️ Running database migrations for $ENVIRONMENT..."

docker-compose -f $COMPOSE_FILE exec $SERVICE npm run db:push

echo "✅ Migrations completed!"
```

### 6.4 Backup Script

**scripts/backup.sh**
```bash
#!/bin/bash

BACKUP_DIR="/opt/inka-ai-assistant/backups"
DATE=$(date +%Y%m%d-%H%M%S)

mkdir -p $BACKUP_DIR

echo "📦 Creating backup: backup-$DATE"

# Database backup
docker-compose -f docker-compose.prod.yml exec -T postgres-prod pg_dump -U $POSTGRES_USER $POSTGRES_DB > "$BACKUP_DIR/db-backup-$DATE.sql"

# Code backup
tar -czf "$BACKUP_DIR/code-backup-$DATE.tar.gz" --exclude=node_modules --exclude=data --exclude=.git .

# Clean old backups (keep last 7 days)
find $BACKUP_DIR -name "*.sql" -mtime +7 -delete
find $BACKUP_DIR -name "*.tar.gz" -mtime +7 -delete

echo "✅ Backup completed: $BACKUP_DIR/backup-$DATE"
```

---

## 7. Monitoring và Logging

### 7.1 Docker Compose với Monitoring

**docker-compose.monitoring.yml**
```yaml
version: '3.8'

services:
  # Prometheus for metrics
  prometheus:
    image: prom/prometheus:latest
    container_name: inka-prometheus
    ports:
      - "9090:9090"
    volumes:
      - ./monitoring/prometheus.yml:/etc/prometheus/prometheus.yml
      - prometheus-data:/prometheus
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.path=/prometheus'
      - '--web.console.libraries=/etc/prometheus/console_libraries'
      - '--web.console.templates=/etc/prometheus/consoles'
    networks:
      - inka-network

  # Grafana for visualization
  grafana:
    image: grafana/grafana:latest
    container_name: inka-grafana
    ports:
      - "3000:3000"
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin123
    volumes:
      - grafana-data:/var/lib/grafana
    networks:
      - inka-network

  # Log aggregation
  fluentd:
    image: fluent/fluentd:v1.14-debian-1
    container_name: inka-fluentd
    volumes:
      - ./monitoring/fluentd.conf:/fluentd/etc/fluent.conf
      - ./data/logs:/var/log
    ports:
      - "24224:24224"
    networks:
      - inka-network

volumes:
  prometheus-data:
  grafana-data:

networks:
  inka-network:
    external: true
```

### 7.2 Cron Jobs cho Maintenance

**crontab**
```bash
# Automatic backups (daily at 2 AM)
0 2 * * * /opt/inka-ai-assistant/scripts/backup.sh

# SSL renewal (monthly)
0 3 1 * * /opt/inka-ai-assistant/scripts/setup-ssl.sh your-domain.com your-email@domain.com

# Log rotation (weekly)
0 4 * * 0 docker system prune -f

# Health check (every 5 minutes)
*/5 * * * * curl -f http://localhost:5000/health || echo "Health check failed at $(date)" >> /var/log/inka-health.log
```

---

## 8. Hướng dẫn Deploy từng bước

### 8.1 Production Deployment

```bash
# 1. Setup VPS và cài đặt Docker
sudo apt update && sudo apt upgrade -y
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# 2. Clone project
cd /opt
sudo git clone https://github.com/your-username/inka-ai-assistant.git
sudo chown -R $USER:$USER inka-ai-assistant
cd inka-ai-assistant

# 3. Setup environment
cp .env.production .env
nano .env  # Chỉnh sửa các giá trị cần thiết

# 4. Setup SSL
chmod +x scripts/setup-ssl.sh
./scripts/setup-ssl.sh your-domain.com your-email@domain.com

# 5. Deploy
chmod +x scripts/deploy.sh
./scripts/deploy.sh production

# 6. Setup monitoring
docker-compose -f docker-compose.monitoring.yml up -d

# 7. Setup cron jobs
crontab -e  # Thêm các cron jobs từ phần 7.2
```

### 8.2 Development Deployment

```bash
# 1. Clone project
git clone https://github.com/your-username/inka-ai-assistant.git
cd inka-ai-assistant

# 2. Setup environment
cp .env.development .env
nano .env  # Chỉnh sửa các giá trị cần thiết

# 3. Deploy
chmod +x scripts/deploy.sh
./scripts/deploy.sh development

# 4. Access application
# Frontend: http://localhost:5173
# Backend: http://localhost:5000
# Database: localhost:5432
```

---

## 9. Troubleshooting

### 9.1 Common Issues

**Container không start được:**
```bash
# Kiểm tra logs
docker-compose logs [service-name]

# Kiểm tra resources
docker system df
free -h
```

**Database connection error:**
```bash
# Kiểm tra database status
docker-compose exec postgres-prod psql -U $POSTGRES_USER -d $POSTGRES_DB -c "SELECT 1;"

# Reset database
docker-compose down -v
docker-compose up -d
```

**SSL issues:**
```bash
# Renew certificates
docker-compose run --rm certbot renew
docker-compose exec nginx nginx -s reload
```

### 9.2 Performance Optimization

**Database optimization:**
```sql
-- Add indexes for better performance
CREATE INDEX CONCURRENTLY idx_call_logs_user_date ON call_logs(user_id, date);
CREATE INDEX CONCURRENTLY idx_call_logs_created_at ON call_logs(created_at);
```

**Nginx optimization:**
```nginx
# Add to nginx.conf
worker_processes auto;
worker_connections 1024;
keepalive_timeout 65;
client_max_body_size 10M;
```

---

## 10. Security Checklist

- [ ] Thay đổi tất cả passwords mặc định
- [ ] Cấu hình firewall (UFW/iptables)
- [ ] Cập nhật SSL certificates định kỳ
- [ ] Backup database thường xuyên
- [ ] Monitor logs và metrics
- [ ] Cấu hình fail2ban cho SSH
- [ ] Sử dụng non-root user cho containers
- [ ] Encrypt sensitive environment variables

---

## 11. Maintenance Commands

```bash
# Update application
git pull origin main
./scripts/deploy.sh production

# Database operations
./scripts/backup.sh
./scripts/migrate.sh production

# Docker maintenance
docker system prune -f
docker volume prune -f

# Monitor logs
docker-compose logs -f --tail=100

# Scale services
docker-compose up -d --scale backend-prod=3
```

---

Tài liệu này cung cấp hướng dẫn đầy đủ để deploy ứng dụng Inka AI Assistant trên VPS với Docker Compose. Đảm bảo tuân thủ tất cả các bước security và thực hiện testing kỹ lưỡng trước khi deploy production.