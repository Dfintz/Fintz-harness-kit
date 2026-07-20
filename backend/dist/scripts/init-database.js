#!/usr/bin/env ts-node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.initializeDatabase = initializeDatabase;
const typeorm_1 = require("typeorm");
const database_1 = require("../config/database");
const logger_1 = require("../utils/logger");
function createInitDataSource() {
    if (process.env.DATABASE_URL) {
        const baseOptions = database_1.AppDataSource.options;
        return new typeorm_1.DataSource({
            ...baseOptions,
            url: process.env.DATABASE_URL,
        });
    }
    return database_1.AppDataSource;
}
async function initializeDatabase() {
    let dataSource;
    try {
        dataSource = createInitDataSource();
        logger_1.logger.info('🚀 Starting database initialization...');
        logger_1.logger.info('📡 Connecting to database...');
        await dataSource.initialize();
        logger_1.logger.info('✅ Database connection established');
        logger_1.logger.info('📊 Checking migration status...');
        const pendingMigrations = await dataSource.showMigrations();
        if (pendingMigrations) {
            logger_1.logger.info('📝 Pending migrations found. Running migrations...');
            const migrations = await dataSource.runMigrations({
                transaction: 'all'
            });
            if (migrations.length > 0) {
                logger_1.logger.info(`✅ Successfully ran ${migrations.length} migration(s):`);
                migrations.forEach(migration => {
                    logger_1.logger.info(`   - ${migration.name}`);
                });
            }
            else {
                logger_1.logger.info('✅ Database is already up to date (no migrations to run)');
            }
        }
        else {
            logger_1.logger.info('✅ Database is already up to date');
        }
        logger_1.logger.info('🔍 Verifying database connection...');
        await dataSource.query('SELECT 1');
        logger_1.logger.info('✅ Database verification successful');
        const dbType = dataSource.options.type;
        const options = dataSource.options;
        logger_1.logger.info(`📋 Database Info:`);
        logger_1.logger.info(`   - Type: ${dbType}`);
        if (options.host) {
            logger_1.logger.info(`   - Host: ${options.host}`);
        }
        if (options.database) {
            logger_1.logger.info(`   - Database: ${options.database}`);
        }
        logger_1.logger.info('🎉 Database initialization completed successfully!');
        await dataSource.destroy();
        process.exit(0);
    }
    catch (error) {
        logger_1.logger.error('❌ Database initialization failed:', error);
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
                logger_1.logger.error('💡 Tip: Create the database first');
                logger_1.logger.error('   Run: createdb sc_fleet_manager');
            }
            else if (error.message.includes('SSL')) {
                logger_1.logger.error('💡 Tip: SSL connection issue');
                logger_1.logger.error('   Set DB_SSL=false if not using SSL');
            }
            else if (error.message.includes('role') && error.message.includes('does not exist')) {
                logger_1.logger.error('💡 Tip: Database role/user does not exist');
                logger_1.logger.error('   Check DATABASE_URL or DB_USER environment variable');
            }
        }
        try {
            if (dataSource) {
                await dataSource.destroy();
            }
        }
        catch {
        }
        process.exit(1);
    }
}
if (require.main === module) {
    void initializeDatabase();
}
//# sourceMappingURL=init-database.js.map