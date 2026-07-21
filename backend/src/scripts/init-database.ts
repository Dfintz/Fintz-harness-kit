#!/usr/bin/env ts-node
/**
 * Database Initialization Script
 * 
 * This script initializes the database by:
 * 1. Connecting to the database
 * 2. Running all pending migrations
 * 3. Verifying the database schema
 * 
 * Usage:
 *   npm run db:init
 *   
 * Environment Variables:
 *   DATABASE_URL - Full database connection string (preferred)
 *   OR
 *   DB_HOST - Database host (default: localhost)
 *   DB_PORT - Database port (default: 5432)
 *   DB_USER - Database user (default: postgres)
 *   DB_PASSWORD - Database password
 *   DB_NAME - Database name (default: sc_fleet_manager)
 *   DB_SSL - Enable SSL (default: true in production)
 */

import { DataSource, DataSourceOptions } from 'typeorm';

import { AppDataSource } from '../config/database';
import { logger } from '../utils/logger';

/**
 * Create a DataSource for initialization
 * Uses DATABASE_URL if available for CI/CD compatibility,
 * otherwise uses the standard AppDataSource configuration
 */
function createInitDataSource(): DataSource {
    if (process.env.DATABASE_URL) {
        // Use DATABASE_URL and merge with AppDataSource options
        // Type assertion to handle the url property which is valid for postgres
        const baseOptions = AppDataSource.options;
        return new DataSource({
            ...baseOptions,
            url: process.env.DATABASE_URL,
        } as DataSourceOptions);
    }
    
    return AppDataSource;
}

async function initializeDatabase(): Promise<void> {
    let dataSource: DataSource | undefined;
    
    try {
        dataSource = createInitDataSource();
        logger.info('🚀 Starting database initialization...');
        
        // Connect to database
        logger.info('📡 Connecting to database...');
        await dataSource.initialize();
        logger.info('✅ Database connection established');
        
        // Check if migrations table exists and show current state
        logger.info('📊 Checking migration status...');
        const pendingMigrations = await dataSource.showMigrations();
        
        if (pendingMigrations) {
            logger.info('📝 Pending migrations found. Running migrations...');
            
            // Run all pending migrations
            const migrations = await dataSource.runMigrations({
                transaction: 'all' // Run all migrations in a single transaction
            });
            
            if (migrations.length > 0) {
                logger.info(`✅ Successfully ran ${migrations.length} migration(s):`);
                migrations.forEach(migration => {
                    logger.info(`   - ${migration.name}`);
                });
            } else {
                logger.info('✅ Database is already up to date (no migrations to run)');
            }
        } else {
            logger.info('✅ Database is already up to date');
        }
        
        // Verify database connection
        logger.info('🔍 Verifying database connection...');
        await dataSource.query('SELECT 1');
        logger.info('✅ Database verification successful');
        
        // Show database info
        const dbType = dataSource.options.type;
        const options = dataSource.options as {
            host?: string;
            database?: string;
        };
        logger.info(`📋 Database Info:`);
        logger.info(`   - Type: ${dbType}`);
        if (options.host) {
            logger.info(`   - Host: ${options.host}`);
        }
        if (options.database) {
            logger.info(`   - Database: ${options.database}`);
        }
        
        logger.info('🎉 Database initialization completed successfully!');
        
        // Close connection
        await dataSource.destroy();
        process.exit(0);
        
    } catch (error) {
        logger.error('❌ Database initialization failed:', error);
        
        // Provide helpful error messages
        if (error instanceof Error) {
            if (error.message.includes('ECONNREFUSED')) {
                logger.error('💡 Tip: Make sure the database server is running');
                logger.error('   Check DB_HOST and DB_PORT environment variables');
            } else if (error.message.includes('password authentication failed')) {
                logger.error('💡 Tip: Check your database credentials');
                logger.error('   Verify DB_USER and DB_PASSWORD environment variables');
            } else if (error.message.includes('database') && error.message.includes('does not exist')) {
                logger.error('💡 Tip: Create the database first');
                logger.error('   Run: createdb sc_fleet_manager');
            } else if (error.message.includes('SSL')) {
                logger.error('💡 Tip: SSL connection issue');
                logger.error('   Set DB_SSL=false if not using SSL');
            } else if (error.message.includes('role') && error.message.includes('does not exist')) {
                logger.error('💡 Tip: Database role/user does not exist');
                logger.error('   Check DATABASE_URL or DB_USER environment variable');
            }
        }
        
        // Clean up and exit with error code
        try {
            if (dataSource) {
                await dataSource.destroy();
            }
        } catch {
            // Ignore cleanup errors
        }
        process.exit(1);
    }
}

// Run the initialization
if (require.main === module) {
    void initializeDatabase();
}

export { initializeDatabase };
