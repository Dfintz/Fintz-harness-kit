# Build stage
# Updated to node:22-alpine (resolves to v22.22.0+) to fix security vulnerabilities:
# - Race Condition
# - Uncaught Exception handling
# - UNIX Symbolic Link (Symlink) Following
# - Directory Traversal
# - Incorrect Authorization
# - Reliance on undefined behavior
FROM node:22-alpine AS builder

# Upgrade all Alpine packages for latest security patches
RUN apk upgrade --no-cache

WORKDIR /app

# Copy root workspace configuration
COPY package.json package-lock.json turbo.json ./

# Copy all workspace package.json files so npm understands the monorepo structure
COPY packages/contracts/package.json ./packages/contracts/
COPY packages/eslint-config/package.json ./packages/eslint-config/
COPY packages/prettier-config/package.json ./packages/prettier-config/
COPY packages/shared-types/package.json ./packages/shared-types/
COPY packages/test-utils/package.json ./packages/test-utils/
COPY packages/tsconfig/package.json ./packages/tsconfig/
COPY backend/package.json ./backend/
COPY frontend/package.json ./frontend/

# Copy frontend scripts for postinstall hook
COPY frontend/scripts ./frontend/scripts
# Copy root security scripts needed by postinstall hook
COPY scripts/security ./scripts/security

# Install dependencies
# Note: npm ci may skip platform-specific optional deps (e.g. @rollup/rollup-linux-x64-musl)
# on Alpine/musl. Explicitly install the native rollup binding for the container platform.
RUN npm ci && npm install @rollup/rollup-linux-x64-musl --no-save 2>/dev/null || true

# Copy and build shared-types
COPY packages/shared-types ./packages/shared-types
RUN npm run build --workspace=@sc-fleet-manager/shared-types

# Copy frontend source code
COPY frontend ./frontend

# Build arguments for Vite environment variables
# These must be passed at build time and will be embedded in the bundle
ARG VITE_API_URL
ARG VITE_DISCORD_CLIENT_ID
ARG VITE_DISCORD_REDIRECT_URI
ARG VITE_WS_URL
ARG VITE_DISCORD_BOT_INVITE_URL
ARG VITE_DISCORD_BOT_CLIENT_ID
ARG VITE_ENABLE_LIVE_DEMO_GUIDE

# Set environment variables for Vite build
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_DISCORD_CLIENT_ID=$VITE_DISCORD_CLIENT_ID
ENV VITE_DISCORD_REDIRECT_URI=$VITE_DISCORD_REDIRECT_URI
ENV VITE_WS_URL=$VITE_WS_URL
ENV VITE_DISCORD_BOT_INVITE_URL=$VITE_DISCORD_BOT_INVITE_URL
ENV VITE_DISCORD_BOT_CLIENT_ID=$VITE_DISCORD_BOT_CLIENT_ID
ENV VITE_ENABLE_LIVE_DEMO_GUIDE=$VITE_ENABLE_LIVE_DEMO_GUIDE

# Build the frontend application
RUN npm run build --workspace=frontend

# Production stage with nginx
FROM nginx:1.30.1-alpine AS production

# Base image bumped to nginx:1.30.1-alpine (resolves nginx-specific CVEs).
# apk upgrade patches any remaining Alpine-layer CVEs.
# Remove curl — not needed (healthcheck uses wget) and has unfixed CVEs.
# busybox CVE-2025-60876 — no fix available upstream yet; accept residual risk.
RUN apk upgrade --no-cache && \
    apk del curl 2>/dev/null || true

# Default backend upstream URL (override via env var in Azure Container Apps or docker-compose)
ENV BACKEND_UPSTREAM=http://backend:3000

# Copy custom nginx config (extracted from heredoc for ACR Tasks compatibility)
COPY frontend/docker/default.conf /etc/nginx/conf.d/default.conf

# Startup script: substitute BACKEND_UPSTREAM placeholder, then start nginx
COPY frontend/docker/25-substitute-backend-url.sh /docker-entrypoint.d/25-substitute-backend-url.sh
RUN chmod +x /docker-entrypoint.d/25-substitute-backend-url.sh

# Copy built application from builder
COPY --from=builder /app/frontend/dist /usr/share/nginx/html

# Create non-root user and fix permissions (single layer)
RUN (addgroup -g 101 -S nginx || true) && \
    (adduser -S nginx -u 101 || true) && \
    chown -R nginx:nginx /usr/share/nginx/html && \
    chown -R nginx:nginx /var/cache/nginx && \
    chown -R nginx:nginx /var/log/nginx && \
    chown -R nginx:nginx /etc/nginx/conf.d && \
    touch /var/run/nginx.pid && \
    chown -R nginx:nginx /var/run/nginx.pid

# Switch to non-root user
USER nginx

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:3000/ || exit 1

# Start nginx
CMD ["nginx", "-g", "daemon off;"]