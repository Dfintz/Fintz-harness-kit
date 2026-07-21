# Build stage
# Updated to node:24.16.0-alpine3.23 to pick up latest Node 24 and Alpine security patches:
# - Race Condition
# - Uncaught Exception handling
# - UNIX Symbolic Link (Symlink) Following
# - Directory Traversal
# - Incorrect Authorization
# - Reliance on undefined behavior
FROM node:24.16.0-alpine3.23 AS builder

# Install build dependencies and upgrade all Alpine packages for security patches
RUN apk upgrade --no-cache && \
    apk add --no-cache python3 make g++

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

# Copy frontend scripts needed by workspace install hooks
COPY frontend/scripts ./frontend/scripts
# Copy root security scripts needed by postinstall hook
COPY scripts/security ./scripts/security

# Install all dependencies (entire workspace to ensure proper linking)
RUN npm ci

# Copy and build shared-types
COPY packages/shared-types ./packages/shared-types
RUN npm run build --workspace=@sc-fleet-manager/shared-types

# Copy and build backend
COPY backend ./backend
RUN npm run build --workspace=backend

# Production stage
# Security: Updated to node:24.16.0-alpine3.23 with all patches
FROM node:24.16.0-alpine3.23 AS production

# Upgrade all Alpine packages to latest patched versions.
# Keep runtime dependencies production-only end-to-end; the sharp install step
# must also use --omit=dev to avoid rehydrating dev-only packages in the final
# image layer.
# Create non-root user
RUN apk upgrade --no-cache && \
    addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

WORKDIR /app

# Copy root workspace files
COPY package.json package-lock.json ./

# Copy shared-types package with built dist
COPY packages/shared-types/package.json ./packages/shared-types/
COPY --from=builder /app/packages/shared-types/dist ./packages/shared-types/dist

# Copy backend package files
COPY backend/package.json ./backend/

# Install only production dependencies for the workspace
# Skip prepare script since husky is a dev-only dependency
# Then install sharp platform-specific binary for Alpine (linuxmusl-x64)
RUN npm ci --omit=dev --ignore-scripts && \
    npm install --omit=dev --no-save --os=linux --libc=musl --cpu=x64 sharp && \
    npm prune --omit=dev && \
    npm cache clean --force && \
    rm -rf /usr/local/lib/node_modules/npm && rm -f /usr/local/bin/npm /usr/local/bin/npx && \
    # Remove build-only packages that have known CVEs (tar used by node-gyp only)
    find node_modules -name 'tar' -path '*/node-gyp/*' -type d -exec rm -rf {} + 2>/dev/null || true

# Copy built backend application from builder stage
COPY --from=builder --chown=nodejs:nodejs /app/backend/dist ./backend/dist

# Copy any additional required files
COPY --chown=nodejs:nodejs backend/src/config ./backend/src/config
# Copy OpenAPI specification for swagger UI
COPY --chown=nodejs:nodejs backend/openapi ./backend/openapi
# Copy schema directory for migrations
COPY --chown=nodejs:nodejs backend/schema ./backend/schema

# Create logs and local uploads directories with proper permissions
# Logs: optional, used when file logging is enabled
# Uploads: must match LOCAL_UPLOADS_DIR in imageController.ts: path.join(process.cwd(), 'data', 'uploads')
RUN mkdir -p /app/backend/logs /app/backend/data/uploads && \
    chown -R nodejs:nodejs /app/backend/logs /app/backend/data

# Set working directory to backend
WORKDIR /app/backend

# Switch to non-root user
USER nodejs

# Expose port
EXPOSE 3000

# Health check (only meaningful for the API container; bot/worker ignore it)
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start application — exec form ensures Node receives SIGTERM for graceful shutdown
CMD ["node", "dist/app.js"]