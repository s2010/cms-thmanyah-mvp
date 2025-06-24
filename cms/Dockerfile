# Build stage
FROM node:20-alpine AS builder

# Set working directory
WORKDIR /app

# Install build dependencies
RUN apk add --no-cache python3 make g++

# Copy package files first for better caching
COPY package*.json ./
COPY tsconfig.json ./
COPY nest-cli.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY src/ ./src/

# Build the application
RUN npm run build

# Production stage
FROM node:20-alpine AS production

# Install runtime dependencies
RUN apk add --no-cache dumb-init wget

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S thmanyah -u 1001 -G nodejs

# Set working directory
WORKDIR /app

# Copy package files and lock file from builder
COPY --from=builder /app/package*.json ./

# Install only production dependencies
RUN npm install --production && npm cache clean --force

# Copy built application from builder stage
COPY --from=builder --chown=thmanyah:nodejs /app/dist ./dist

# Set default port (NODE_ENV will come from docker-compose)
ENV PORT=3000

# Switch to non-root user
USER thmanyah

# Expose port
EXPOSE 3000

# Add health check using wget
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health/live || exit 1

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start the application
CMD ["node", "dist/main.js"] 