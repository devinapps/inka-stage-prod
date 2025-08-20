#!/usr/bin/env node

// Production startup script
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import { existsSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Set production environment
process.env.NODE_ENV = 'production';

// Check if built files exist
const distPath = resolve(__dirname, 'dist');
const publicPath = resolve(distPath, 'public');
const serverPath = resolve(distPath, 'index.js');

if (!existsSync(serverPath)) {
  console.error('❌ Build files not found. Please run "npm run build" first.');
  process.exit(1);
}

if (!existsSync(publicPath)) {
  console.error('❌ Frontend build files not found. Please run "npm run build" first.');
  process.exit(1);
}

console.log('✅ Starting production server...');
console.log(`📁 Serving static files from: ${publicPath}`);
console.log(`🖥️  Server executable: ${serverPath}`);

// Import and start the server
import('./dist/index.js').catch(err => {
  console.error('❌ Failed to start server:', err);
  process.exit(1);
});