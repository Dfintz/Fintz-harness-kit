-- ============================================================================
-- Star Citizen Fleet Manager - Database Initialization Script
-- ============================================================================
-- Generated: 2026-01-16
-- PostgreSQL 16+
-- ============================================================================
-- 
-- USAGE:
--   psql -U fleet_manager -d fleet_manager_db -f init-database.sql
-- 
--   OR in Docker:
--   docker cp init-database.sql postgres-container:/tmp/
--   docker exec -i postgres-container psql -U fleet_manager -d fleet_manager_db -f /tmp/init-database.sql
-- 
-- ============================================================================

-- Enable required PostgreSQL extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- MIGRATIONS TRACKING TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS "migrations" (
    "id" SERIAL PRIMARY KEY,
    "timestamp" BIGINT NOT NULL,
    "name" VARCHAR NOT NULL,
    "executed_at" TIMESTAMP DEFAULT NOW()
);

-- ============================================================================
-- CRITICAL FIX: Make feature_flags.created_by nullable
-- ============================================================================
-- This fixes the UUID validation error for system-created feature flags

ALTER TABLE IF EXISTS "feature_flags" 
ALTER COLUMN "created_by" DROP NOT NULL;

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE 'Database initialization complete!';
    RAISE NOTICE 'To run TypeORM migrations, use: npm run migration:run';
END $$;

-- Show current schema version
SELECT 
    'Migrations Table Ready' as status,
    COUNT(*) as total_migrations
FROM "migrations";

