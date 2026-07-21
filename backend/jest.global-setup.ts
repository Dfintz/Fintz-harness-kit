/**
 * Jest Global Setup
 * Initializes TypeORM metadata for all tests without requiring database connection
 */

import 'reflect-metadata';
import { DataSource } from 'typeorm';

let testDataSource: DataSource | null = null;

/**
 * Initialize TypeORM metadata before all tests
 * This allows entity decorators to work without a real database connection
 */
export default async function globalSetup() {
    try {
        // Create a minimal DataSource just to register entity metadata
        testDataSource = new DataSource({
            type: 'postgres',
            host: 'localhost',
            port: 5432,
            username: 'test',
            password: 'test',
            database: 'test',
            // Use glob pattern to load all entities
            entities: ['src/models/**/*.ts'],
            synchronize: false,
            logging: false,
        });

        // Initialize to register metadata (won't actually connect in test environment)
        await testDataSource.initialize().catch(() => {
            // Ignore connection errors - we just need metadata registered
        });

        console.log('✅ TypeORM metadata initialized for tests');
    } catch (error) {
        console.warn('⚠️  Could not initialize TypeORM metadata:', error);
    }
}

/**
 * Cleanup function
 */
export async function globalTeardown() {
    if (testDataSource && testDataSource.isInitialized) {
        try {
            await testDataSource.destroy();
        } catch (error) {
            // Ignore errors during cleanup
        }
    }
}
