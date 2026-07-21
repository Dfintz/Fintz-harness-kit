#!/usr/bin/env ts-node
/**
 * Database Cleanup Script for CI/CD
 * 
 * This script cleans the database by:
 * 1. Dropping all existing tables, views, and sequences
 * 2. Clearing any existing data
 * 3. Ensuring a fresh database state for testing
 * 
 * Usage:
 *   npm run db:clean
 *   ts-node src/scripts/clean-database.ts
 *   
 * Environment Variables:
 *   DATABASE_URL - Full database connection string (preferred)
 *   OR
 *   DB_HOST - Database host (default: localhost)
 *   DB_PORT - Database port (default: 5432)
 *   DB_USER - Database user (default: postgres)
 *   DB_PASSWORD - Database password
 *   DB_NAME - Database name (default: sc_fleet_manager)
 * 
 * Security Note:
 *   This script is designed for test/CI environments only.
 *   DO NOT run this on production databases!
 */

import { DataSource } from 'typeorm';

import { logger } from '../utils/logger';

/**
 * Create a minimal DataSource for database cleanup
 * Uses DATABASE_URL if available, otherwise falls back to individual env vars
 */
function createCleanupDataSource(): DataSource {
    if (process.env.DATABASE_URL) {
        return new DataSource({
            type: 'postgres',
            url: process.env.DATABASE_URL,
            synchronize: false,
            logging: false,
        });
    }

    return new DataSource({
        type: 'postgres',
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '5432', 10),
        username: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'sc_fleet_manager',
        synchronize: false,
        logging: false,
    });
}

/**
 * Clean the database by dropping all tables, views, sequences, and types
 */
async function cleanDatabase(): Promise<void> {
    const dataSource = createCleanupDataSource();
    
    try {
        logger.info('🧹 Starting database cleanup...');
        
        // Connect to database
        logger.info('📡 Connecting to database...');
        await dataSource.initialize();
        logger.info('✅ Database connection established');
        
        // Get database name for logging
        const dbName = dataSource.options.type === 'postgres' && 'database' in dataSource.options
            ? dataSource.options.database 
            : 'unknown';
        logger.info(`📋 Cleaning database: ${dbName}`);
        
        // Safety check - prevent running on production
        if (process.env.NODE_ENV === 'production' && !process.env.ALLOW_DB_CLEAN) {
            throw new Error(
                'Database cleanup is not allowed in production environment. ' +
                'Set ALLOW_DB_CLEAN=true to override (not recommended).'
            );
        }
        
        // Drop all tables using CASCADE to handle foreign key constraints
        logger.info('🗑️  Dropping all tables...');
        await dataSource.query(`
            DO $$ DECLARE
                r RECORD;
            BEGIN
                -- Drop all tables in public schema
                FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
                    EXECUTE 'DROP TABLE IF EXISTS ' || quote_ident(r.tablename) || ' CASCADE';
                END LOOP;
            END $$;
        `);
        logger.info('✅ All tables dropped');
        
        // Drop all views
        logger.info('🗑️  Dropping all views...');
        await dataSource.query(`
            DO $$ DECLARE
                r RECORD;
            BEGIN
                -- Drop all views in public schema
                FOR r IN (SELECT viewname FROM pg_views WHERE schemaname = 'public') LOOP
                    EXECUTE 'DROP VIEW IF EXISTS ' || quote_ident(r.viewname) || ' CASCADE';
                END LOOP;
            END $$;
        `);
        logger.info('✅ All views dropped');
        
        // Drop all sequences
        logger.info('🗑️  Dropping all sequences...');
        await dataSource.query(`
            DO $$ DECLARE
                r RECORD;
            BEGIN
                -- Drop all sequences in public schema
                FOR r IN (SELECT sequencename FROM pg_sequences WHERE schemaname = 'public') LOOP
                    EXECUTE 'DROP SEQUENCE IF EXISTS ' || quote_ident(r.sequencename) || ' CASCADE';
                END LOOP;
            END $$;
        `);
        logger.info('✅ All sequences dropped');
        
        // Drop all custom types (enums, etc.)
        logger.info('🗑️  Dropping all custom types...');
        await dataSource.query(`
            DO $$ DECLARE
                r RECORD;
            BEGIN
                -- Drop all custom types in public schema
                FOR r IN (
                    SELECT typname 
                    FROM pg_type t
                    JOIN pg_namespace n ON n.oid = t.typnamespace
                    WHERE n.nspname = 'public' 
                    AND t.typtype = 'e'
                ) LOOP
                    EXECUTE 'DROP TYPE IF EXISTS ' || quote_ident(r.typname) || ' CASCADE';
                END LOOP;
            END $$;
        `);
        logger.info('✅ All custom types dropped');
        
        // Verify the database is clean
        const tableCount = await dataSource.query(
            "SELECT COUNT(*) as count FROM pg_tables WHERE schemaname = 'public'"
        );
        const viewCount = await dataSource.query(
            "SELECT COUNT(*) as count FROM pg_views WHERE schemaname = 'public'"
        );
        const sequenceCount = await dataSource.query(
            "SELECT COUNT(*) as count FROM pg_sequences WHERE schemaname = 'public'"
        );
        
        logger.info('📊 Cleanup verification:');
        logger.info(`   - Tables remaining: ${tableCount[0].count}`);
        logger.info(`   - Views remaining: ${viewCount[0].count}`);
        logger.info(`   - Sequences remaining: ${sequenceCount[0].count}`);
        
        if (parseInt(tableCount[0].count) === 0 && parseInt(viewCount[0].count) === 0) {
            logger.info('🎉 Database cleaned successfully!');
        } else {
            logger.warn('⚠️  Database may not be completely clean');
        }
        
        // Close connection
        await dataSource.destroy();
        process.exit(0);
        
    } catch (error) {
        logger.error('❌ Database cleanup failed:', error);
        
        // Provide helpful error messages
        if (error instanceof Error) {
            if (error.message.includes('ECONNREFUSED')) {
                logger.error('💡 Tip: Make sure the database server is running');
                logger.error('   Check DB_HOST and DB_PORT environment variables');
            } else if (error.message.includes('password authentication failed')) {
                logger.error('💡 Tip: Check your database credentials');
                logger.error('   Verify DB_USER and DB_PASSWORD environment variables');
            } else if (error.message.includes('database') && error.message.includes('does not exist')) {
                logger.error('💡 Tip: The database does not exist');
                logger.error('   Create it first or check DB_NAME environment variable');
            } else if (error.message.includes('production')) {
                logger.error('💡 Safety: This script is blocked in production');
                logger.error('   This is intentional to prevent accidental data loss');
            }
        }
        
        // Clean up and exit with error code
        try {
            await dataSource.destroy();
        } catch {
            // Ignore cleanup errors
        }
        process.exit(1);
    }
}

// Run the cleanup if executed directly
if (require.main === module) {
    void cleanDatabase();
}

export { cleanDatabase };
