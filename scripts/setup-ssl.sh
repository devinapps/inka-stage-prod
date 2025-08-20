#!/bin/bash

DOMAIN=${1:-your-domain.com}
EMAIL=${2:-your-email@domain.com}

echo "🔒 Setting up SSL for domain: $DOMAIN"

# Check if domain and email are provided
if [ "$DOMAIN" = "your-domain.com" ] || [ "$EMAIL" = "your-email@domain.com" ]; then
    echo "❌ Please provide valid domain and email:"
    echo "Usage: $0 your-domain.com your-email@domain.com"
    exit 1
fi

# Create directories
mkdir -p ssl data/certbot

# Update nginx config with actual domain
sed -i "s/your-domain.com/$DOMAIN/g" docker/nginx/nginx.conf

# Update environment file
if [ -f ".env.production" ]; then
    sed -i "s/DOMAIN=.*/DOMAIN=$DOMAIN/" .env.production
    sed -i "s/EMAIL=.*/EMAIL=$EMAIL/" .env.production
fi

# Start nginx without SSL first
echo "🚀 Starting nginx for certificate validation..."
docker-compose -f docker-compose.prod.yml up -d nginx

# Wait for nginx to be ready
sleep 10

# Initial certificate request
echo "📜 Requesting SSL certificate..."
docker-compose -f docker-compose.prod.yml run --rm certbot certonly \
    --webroot \
    --webroot-path=/var/www/certbot \
    --email $EMAIL \
    --agree-tos \
    --no-eff-email \
    -d $DOMAIN \
    -d www.$DOMAIN

if [ $? -eq 0 ]; then
    echo "✅ SSL certificate obtained successfully!"
    
    # Reload nginx to use new certificates
    echo "🔄 Reloading nginx with SSL..."
    docker-compose -f docker-compose.prod.yml exec nginx nginx -s reload
    
    # Setup auto-renewal
    echo "⏰ Setting up auto-renewal..."
    (crontab -l 2>/dev/null; echo "0 3 1 * * /opt/inka-ai-assistant/scripts/setup-ssl.sh $DOMAIN $EMAIL") | crontab -
    
    echo "✅ SSL setup completed!"
    echo "🌐 Your site should now be available at: https://$DOMAIN"
else
    echo "❌ SSL certificate request failed!"
    echo "Please check:"
    echo "1. Domain points to this server"
    echo "2. Ports 80 and 443 are open"
    echo "3. Nginx is running and accessible"
    exit 1
fi