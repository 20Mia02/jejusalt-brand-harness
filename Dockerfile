# Multi-stage build for Node.js backend and React frontend

# Stage 1: Build frontend
FROM node:18-alpine AS frontend-build
WORKDIR /app/jejusalt-frontend
COPY jejusalt-frontend/package*.json ./
RUN npm ci
COPY jejusalt-frontend/ .
RUN npm run build

# Stage 2: Build backend
FROM node:18-alpine AS backend-build
WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm ci
COPY backend/ .

# Stage 3: Production image
FROM node:18-alpine
WORKDIR /app

# Install necessary dependencies
RUN apk add --no-cache dumb-init

# Copy backend
COPY --from=backend-build /app/backend ./backend

# Copy built frontend to backend public directory (if needed)
COPY --from=frontend-build /app/jejusalt-frontend/dist ./public

# Copy root files (config.json, etc)
COPY config.json .env* ./

# Install backend dependencies only
WORKDIR /app/backend
RUN npm ci --only=production

WORKDIR /app

# Create non-root user
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001

USER nodejs

EXPOSE 5000

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "backend/server.js"]
