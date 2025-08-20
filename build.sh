#!/bin/bash
# Production build script

echo "Installing all dependencies for build..."
npm ci

echo "Building application..."
npm run build

echo "Cleaning up and installing production dependencies only..."
npm ci --only=production

echo "Build completed successfully!"
echo "Production files available in dist/ directory"