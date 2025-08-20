#!/bin/bash
# Production deployment script for Replit

echo "Building application for production..."

# Install dependencies
npm ci --only=production

# Build the application
npm run build

echo "Build completed successfully!"
echo "Starting production server..."

# Start the production server
npm start