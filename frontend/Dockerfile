# Development-optimized Dockerfile for Frontend
FROM node:18-alpine

# Install system dependencies
RUN apk add --no-cache curl

WORKDIR /app

# Copy package files for dependency installation
COPY package.json package-lock.json* ./

# Install dependencies efficiently
RUN npm ci --prefer-offline --no-audit --progress=false

# Copy source code (will be overridden by volume mount in development)
COPY . .

# Expose port
EXPOSE 3000

# Set environment variables for performance
ENV NODE_ENV=development
ENV NEXT_TELEMETRY_DISABLED=1
ENV TURBO_TELEMETRY_DISABLED=1

# Health check
HEALTHCHECK --interval=15s --timeout=3s --start-period=10s --retries=2 \
  CMD curl -f http://localhost:3000 || exit 1

# Run development server
CMD ["npm", "run", "dev", "--", "--hostname", "0.0.0.0", "--port", "3000"]