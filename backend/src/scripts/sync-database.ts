#!/usr/bin/env ts-node
/**
 * Database Synchronization Script
 *
 * This script synchronizes the database schema with the TypeORM entities.
 * It will create all tables, columns, and relations based on the entity definitions.
 *
 * WARNING: This should only be used in development. In production, use migrations.
 */

import * as path from 'path';

import dotenv from 'dotenv';
import { DataSource } from 'typeorm';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../.env') });

// Import all entities
import { AccountAccessLog } from '../models/AccountAccessLog';
import { AccountPermission } from '../models/AccountPermission';
import { Activity } from '../models/Activity';
import { AllianceDiplomacy } from '../models/AllianceDiplomacy';
import { Briefing } from '../models/Briefing';
import { CargoManifest } from '../models/CargoManifest';
import { CrewAssignment } from '../models/CrewAssignment';
import { Fleet } from '../models/Fleet';
import { FleetLogistics } from '../models/FleetLogistics';
import { MiningOperation } from '../models/MiningOperation';
import { Organization } from '../models/Organization';
import { OrganizationMembership } from '../models/OrganizationMembership';
import { Permission } from '../models/Permission';
import { RefreshToken } from '../models/RefreshToken';
import { Reputation } from '../models/Reputation';
import { SecurityLevel } from '../models/SecurityLevel';
import { SharedAccount } from '../models/SharedAccount';
import { Ship } from '../models/Ship';
import { ShipLoadout } from '../models/ShipLoadout';
import { ShipLoan } from '../models/ShipLoan';
import { ShipMaintenance } from '../models/ShipMaintenance';
import { Tournament } from '../models/Tournament';
import { TradingRoute } from '../models/TradingRoute';
import { User } from '../models/User';
import { logger } from '../utils/logger';

async function synchronizeDatabase() {
  logger.info('🔄 Starting database synchronization...\n');

  // Create a temporary DataSource with synchronize enabled
  const appDataSource = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    username: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_NAME || 'sc_fleet_manager',
    synchronize: true, // Enable automatic schema sync
    logging: true,
    entities: [
      User,
      Fleet,
      Organization,
      Tournament,
      MiningOperation,
      TradingRoute,
      ShipMaintenance,
      CrewAssignment,
      ShipLoan,
      Reputation,
      CargoManifest,
      AllianceDiplomacy,
      FleetLogistics,
      RefreshToken,
      ShipLoadout,
      Briefing,
      Permission,
      SecurityLevel,
      SharedAccount,
      AccountAccessLog,
      AccountPermission,
      Activity,
      Ship,
      OrganizationMembership,
    ],
  });

  try {
    // Initialize the data source (this will trigger synchronization)
    logger.info('📡 Connecting to database...');
    await appDataSource.initialize();
    logger.info('✅ Database connected successfully!\n');

    logger.info('🔨 Synchronizing schema with entities...');
    await appDataSource.synchronize();
    logger.info('✅ Schema synchronized successfully!\n');

    // Close the connection
    await appDataSource.destroy();
    logger.info('✅ Database synchronization completed!\n');

    logger.info('📝 Next steps:');
    logger.info('   1. Run migrations: npm run migration:run');
    logger.info('   2. Start the application: npm start\n');
  } catch (error) {
    logger.error('❌ Error during synchronization:', error);
    process.exit(1);
  }
}

// Run the synchronization
synchronizeDatabase()
  .then(() => {
    logger.info('✅ Script completed successfully');
    process.exit(0);
  })
  .catch(error => {
    logger.error('❌ Script failed:', error);
    process.exit(1);
  });
