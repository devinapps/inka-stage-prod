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