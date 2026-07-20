#!/usr/bin/env ts-node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cleanDatabase = cleanDatabase;
const typeorm_1 = require("typeorm");
const logger_1 = require("../utils/logger");
function createCleanupDataSource() {
    if (process.env.DATABASE_URL) {
        return new typeorm_1.DataSource({
            type: 'postgres',
            url: process.env.DATABASE_URL,
            synchronize: false,
            logging: false,
        });
    }
    return new typeorm_1.DataSource({
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
async function cleanDatabase() {
    const dataSource = createCleanupDataSource();
    try {
        logger_1.logger.info('🧹 Starting database cleanup...');
        logger_1.logger.info('📡 Connecting to database...');
        await dataSource.initialize();
        logger_1.logger.info('✅ Database connection established');
        const dbName = dataSource.options.type === 'postgres' && 'database' in dataSource.options
            ? dataSource.options.database
            : 'unknown';
        logger_1.logger.info(`📋 Cleaning database: ${dbName}`);
        if (process.env.NODE_ENV === 'production' && !process.env.ALLOW_DB_CLEAN) {
            throw new Error('Database cleanup is not allowed in production environment. ' +
                'Set ALLOW_DB_CLEAN=true to override (not recommended).');
        }
        logger_1.logger.info('🗑️  Dropping all tables...');
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
        logger_1.logger.info('✅ All tables dropped');
        logger_1.logger.info('🗑️  Dropping all views...');
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
        logger_1.logger.info('✅ All views dropped');
        logger_1.logger.info('🗑️  Dropping all sequences...');
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
        logger_1.logger.info('✅ All sequences dropped');
        logger_1.logger.info('🗑️  Dropping all custom types...');
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
        logger_1.logger.info('✅ All custom types dropped');
        const tableCount = await dataSource.query("SELECT COUNT(*) as count FROM pg_tables WHERE schemaname = 'public'");
        const viewCount = await dataSource.query("SELECT COUNT(*) as count FROM pg_views WHERE schemaname = 'public'");
        const sequenceCount = await dataSource.query("SELECT COUNT(*) as count FROM pg_sequences WHERE schemaname = 'public'");
        logger_1.logger.info('📊 Cleanup verification:');
        logger_1.logger.info(`   - Tables remaining: ${tableCount[0].count}`);
        logger_1.logger.info(`   - Views remaining: ${viewCount[0].count}`);
        logger_1.logger.info(`   - Sequences remaining: ${sequenceCount[0].count}`);
        if (parseInt(tableCount[0].count) === 0 && parseInt(viewCount[0].count) === 0) {
            logger_1.logger.info('🎉 Database cleaned successfully!');
        }
        else {
            logger_1.logger.warn('⚠️  Database may not be completely clean');
        }
        await dataSource.destroy();
        process.exit(0);
    }
    catch (error) {
        logger_1.logger.error('❌ Database cleanup failed:', error);
        if (error instanceof Error) {
            if (error.message.includes('ECONNREFUSED')) {
                logger_1.logger.error('💡 Tip: Make sure the database server is running');
                logger_1.logger.error('   Check DB_HOST and DB_PORT environment variables');
            }
            else if (error.message.includes('password authentication failed')) {
                logger_1.logger.error('💡 Tip: Check your database credentials');
                logger_1.logger.error('   Verify DB_USER and DB_PASSWORD environment variables');
            }
            else if (error.message.includes('database') && error.message.includes('does not exist')) {
                logger_1.logger.error('💡 Tip: The database does not exist');
                logger_1.logger.error('   Create it first or check DB_NAME environment variable');
            }
            else if (error.message.includes('production')) {
                logger_1.logger.error('💡 Safety: This script is blocked in production');
                logger_1.logger.error('   This is intentional to prevent accidental data loss');
            }
        }
        try {
            await dataSource.destroy();
        }
        catch {
        }
        process.exit(1);
    }
}
if (require.main === module) {
    void cleanDatabase();
}
//# sourceMappingURL=clean-database.js.map