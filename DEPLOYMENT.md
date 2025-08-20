# Deployment Guide

## ⚠️ Configuration Conflict Resolution

**Issue**: Deployment is blocked due to conflicting configuration between `.replit` and `replit.toml` files.

**Solution**: The `replit.toml` file contains the correct production configuration. If deployment fails:

1. **Use the Replit Console**: Run the following commands in the Replit shell:
   ```bash
   # Build for production
   npm run build
   
   # Test production server
   npm start
   ```

2. **Verify Environment Variables**: Ensure these are set in your Replit deployment:
   - `DATABASE_URL`: PostgreSQL connection string
   - `ELEVENLABS_API_KEY`: ElevenLabs API key for voice features
   - `VITE_ELEVENLABS_AGENT_ID`: ElevenLabs agent ID
   - `NODE_ENV`: Set to "production"

3. **Manual Deployment**: If the auto-deployment fails, you can manually deploy by:
   - Building the project with `npm run build`
   - Starting with `npm start`

## Production Deployment Configuration

This project has been configured for production deployment on Replit with the following setup:

### Build Configuration
- **Build Command**: `npm ci --only=production && npm run build`
- **Run Command**: `npm start`
- **Environment**: `NODE_ENV=production`

### Build Process
1. **Frontend Build**: Vite builds optimized static assets to `dist/public/`
2. **Backend Build**: esbuild bundles Express server to `dist/index.js`
3. **Production Server**: Serves static files and API on port 5000

### Deployment Files
- `replit.toml`: Contains deployment configuration for Replit
- `deploy.sh`: Optional deployment script for manual builds
- `production-start.js`: Production startup verification script

### Required Environment Variables
Ensure these are set in your Replit deployment:
- `DATABASE_URL`: PostgreSQL connection string
- `ELEVENLABS_API_KEY`: ElevenLabs API key for voice features
- `VITE_ELEVENLABS_AGENT_ID`: ElevenLabs agent ID
- `NODE_ENV`: Set to "production"

### Manual Deployment Steps
If deploying manually:
1. Build the application: `npm run build`
2. Start production server: `npm start`

### Troubleshooting
- Ensure all environment variables are properly configured
- Check that the database is accessible from the production environment
- Verify ElevenLabs API credentials are valid

## Security Considerations
- Production mode disables development tools and hot reloading
- Static files are served efficiently without Vite middleware
- Database connections use connection pooling for production
- Environment variables are loaded securely via dotenv

The application will be available on your Replit deployment URL once deployed.