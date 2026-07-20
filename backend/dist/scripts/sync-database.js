#!/usr/bin/env ts-node
"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const path = __importStar(require("path"));
const dotenv_1 = __importDefault(require("dotenv"));
const typeorm_1 = require("typeorm");
dotenv_1.default.config({ path: path.join(__dirname, '../../.env') });
const AccountAccessLog_1 = require("../models/AccountAccessLog");
const AccountPermission_1 = require("../models/AccountPermission");
const Activity_1 = require("../models/Activity");
const AllianceDiplomacy_1 = require("../models/AllianceDiplomacy");
const Briefing_1 = require("../models/Briefing");
const CargoManifest_1 = require("../models/CargoManifest");
const CrewAssignment_1 = require("../models/CrewAssignment");
const Fleet_1 = require("../models/Fleet");
const FleetLogistics_1 = require("../models/FleetLogistics");
const MiningOperation_1 = require("../models/MiningOperation");
const Organization_1 = require("../models/Organization");
const OrganizationMembership_1 = require("../models/OrganizationMembership");
const Permission_1 = require("../models/Permission");
const RefreshToken_1 = require("../models/RefreshToken");
const Reputation_1 = require("../models/Reputation");
const SecurityLevel_1 = require("../models/SecurityLevel");
const SharedAccount_1 = require("../models/SharedAccount");
const Ship_1 = require("../models/Ship");
const ShipLoadout_1 = require("../models/ShipLoadout");
const ShipLoan_1 = require("../models/ShipLoan");
const ShipMaintenance_1 = require("../models/ShipMaintenance");
const Tournament_1 = require("../models/Tournament");
const TradingRoute_1 = require("../models/TradingRoute");
const User_1 = require("../models/User");
const logger_1 = require("../utils/logger");
async function synchronizeDatabase() {
    logger_1.logger.info('🔄 Starting database synchronization...\n');
    const appDataSource = new typeorm_1.DataSource({
        type: 'postgres',
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '5432'),
        username: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || 'postgres',
        database: process.env.DB_NAME || 'sc_fleet_manager',
        synchronize: true,
        logging: true,
        entities: [
            User_1.User,
            Fleet_1.Fleet,
            Organization_1.Organization,
            Tournament_1.Tournament,
            MiningOperation_1.MiningOperation,
            TradingRoute_1.TradingRoute,
            ShipMaintenance_1.ShipMaintenance,
            CrewAssignment_1.CrewAssignment,
            ShipLoan_1.ShipLoan,
            Reputation_1.Reputation,
            CargoManifest_1.CargoManifest,
            AllianceDiplomacy_1.AllianceDiplomacy,
            FleetLogistics_1.FleetLogistics,
            RefreshToken_1.RefreshToken,
            ShipLoadout_1.ShipLoadout,
            Briefing_1.Briefing,
            Permission_1.Permission,
            SecurityLevel_1.SecurityLevel,
            SharedAccount_1.SharedAccount,
            AccountAccessLog_1.AccountAccessLog,
            AccountPermission_1.AccountPermission,
            Activity_1.Activity,
            Ship_1.Ship,
            OrganizationMembership_1.OrganizationMembership,
        ],
    });
    try {
        logger_1.logger.info('📡 Connecting to database...');
        await appDataSource.initialize();
        logger_1.logger.info('✅ Database connected successfully!\n');
        logger_1.logger.info('🔨 Synchronizing schema with entities...');
        await appDataSource.synchronize();
        logger_1.logger.info('✅ Schema synchronized successfully!\n');
        await appDataSource.destroy();
        logger_1.logger.info('✅ Database synchronization completed!\n');
        logger_1.logger.info('📝 Next steps:');
        logger_1.logger.info('   1. Run migrations: npm run migration:run');
        logger_1.logger.info('   2. Start the application: npm start\n');
    }
    catch (error) {
        logger_1.logger.error('❌ Error during synchronization:', error);
        process.exit(1);
    }
}
synchronizeDatabase()
    .then(() => {
    logger_1.logger.info('✅ Script completed successfully');
    process.exit(0);
})
    .catch(error => {
    logger_1.logger.error('❌ Script failed:', error);
    process.exit(1);
});
//# sourceMappingURL=sync-database.js.map