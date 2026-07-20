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
Object.defineProperty(exports, "__esModule", { value: true });
exports.FleetHealthService = exports.STANDBY_CREW_RATIO = void 0;
const typeorm_1 = require("typeorm");
const data_source_1 = require("../../data-source");
const Fleet_1 = require("../../models/Fleet");
const FleetShip_1 = require("../../models/FleetShip");
const TeamMember_1 = require("../../models/TeamMember");
const apiErrors_1 = require("../../utils/apiErrors");
const crewCalculation_1 = require("../../utils/crewCalculation");
const logger_1 = require("../../utils/logger");
exports.STANDBY_CREW_RATIO = 0.3;
const ACTIVE_CREW_STATUSES = ['active', 'deployed'];
class FleetHealthService {
    async calculateFleetHealth(organizationId, fleetId) {
        const fleetRepo = data_source_1.AppDataSource.getRepository(Fleet_1.Fleet);
        const fleet = await fleetRepo.findOne({ where: { id: fleetId, organizationId } });
        if (!fleet) {
            throw new apiErrors_1.NotFoundError('Fleet', fleetId);
        }
        if (!fleet.teamId) {
            try {
                const { FleetTeamService } = await Promise.resolve().then(() => __importStar(require('./FleetTeamService')));
                const fleetTeamService = FleetTeamService.getInstance();
                await fleetTeamService.autoCreateTeamForFleet(organizationId, fleet);
                await fleetTeamService.syncTeamCapacity(organizationId, fleetId);
            }
            catch (err) {
                logger_1.logger.warn('Failed to backfill fleet team during health check', {
                    fleetId,
                    error: err instanceof Error ? err.message : String(err),
                });
            }
        }
        const fleetShipRepo = data_source_1.AppDataSource.getRepository(FleetShip_1.FleetShip);
        const fleetShips = await fleetShipRepo.find({
            where: { fleetId, organizationId },
            relations: ['ship'],
        });
        const ships = fleetShips.map(fs => fs.ship).filter(Boolean);
        const crewMode = fleet.crewMode || 'conservative';
        const crewHealth = await this.calculateCrewHealth(organizationId, fleet, ships, crewMode);
        const maintenanceHealth = this.calculateMaintenanceHealth(ships);
        const totalShips = ships.length;
        const flightReadyCount = ships.filter(s => s.status === 'flight_ready').length;
        const readinessScore = totalShips > 0 ? (flightReadyCount / totalShips) * 100 : 0;
        const capabilityScore = this.computeCapabilityScore(ships);
        const operationalScore = this.computeOperationalScore(fleet);
        const healthScore = Math.round(readinessScore * 0.35 +
            crewHealth.crewFillRate * 0.25 +
            capabilityScore * 0.2 +
            operationalScore * 0.2);
        let status;
        if (healthScore >= 75) {
            status = 'green';
        }
        else if (healthScore >= 50) {
            status = 'yellow';
        }
        else {
            status = 'red';
        }
        return {
            fleetId: fleet.id,
            fleetName: fleet.name,
            healthScore,
            status,
            breakdown: {
                readinessScore: Math.round(readinessScore),
                crewFillRate: Math.round(crewHealth.crewFillRate),
                capabilityScore: Math.round(capabilityScore),
                operationalScore: Math.round(operationalScore),
            },
            details: {
                totalShips,
                flightReadyShips: flightReadyCount,
                totalCrewPositions: crewHealth.totalRequired,
                crewFilled: crewHealth.totalFilled,
                crewMode,
                overallGatePassed: crewHealth.overallGatePassed,
                standbySlots: crewHealth.standbySlots,
                standbyFilled: crewHealth.standbyFilled,
                fleetStatus: fleet.status,
            },
            crewHealth,
            maintenanceHealth,
        };
    }
    async calculateCrewHealth(organizationId, fleet, ships, crewMode) {
        let activeMembers = [];
        if (fleet.teamId) {
            const memberRepo = data_source_1.AppDataSource.getRepository(TeamMember_1.TeamMember);
            activeMembers = await memberRepo.find({
                where: {
                    teamId: fleet.teamId,
                    organizationId,
                    status: (0, typeorm_1.In)([...ACTIVE_CREW_STATUSES]),
                },
            });
        }
        const totalFilled = activeMembers.length;
        const assignedPerShip = new Map();
        for (const member of activeMembers) {
            if (member.assignedShipId) {
                assignedPerShip.set(member.assignedShipId, (assignedPerShip.get(member.assignedShipId) ?? 0) + 1);
            }
        }
        const perShip = ships.map(ship => {
            const effectiveCrew = (0, crewCalculation_1.resolveShipCrew)(ship);
            const lean = (0, crewCalculation_1.calculateCrewRequirements)(effectiveCrew, 'lean');
            const conservative = (0, crewCalculation_1.calculateCrewRequirements)(effectiveCrew, 'conservative');
            const filled = Math.min(assignedPerShip.get(ship.id) ?? 0, effectiveCrew);
            return {
                shipId: ship.id,
                shipName: ship.name,
                maxCrew: effectiveCrew,
                leanRequired: lean.minCrew,
                conservativeRequired: conservative.minCrew,
                filled,
                passesLean: filled >= lean.minCrew,
                passesConservative: filled >= conservative.minCrew,
            };
        });
        const computeGateStatus = () => {
            if (perShip.length === 0) {
                return true;
            }
            if (crewMode === 'lean') {
                return perShip.every(s => s.passesLean);
            }
            return perShip.every(s => s.passesConservative);
        };
        const overallGatePassed = computeGateStatus();
        const requiredKey = crewMode === 'lean' ? 'leanRequired' : 'conservativeRequired';
        const totalRequired = perShip.reduce((sum, s) => sum + s[requiredKey], 0);
        const totalMaxCrew = perShip.reduce((sum, s) => sum + s.maxCrew, 0);
        const standbySlots = Math.ceil(totalMaxCrew * exports.STANDBY_CREW_RATIO);
        const standbyFilled = Math.max(0, totalFilled - totalMaxCrew);
        const crewFillRate = totalRequired > 0 ? Math.min((totalFilled / totalRequired) * 100, 100) : 0;
        return {
            crewFillRate,
            totalRequired,
            totalFilled,
            totalMaxCrew,
            standbySlots,
            standbyFilled,
            perShip,
            overallGatePassed,
            crewMode,
        };
    }
    calculateTeamCapacity(ships) {
        const totalCrewPositions = ships.reduce((sum, ship) => sum + (0, crewCalculation_1.resolveShipCrew)(ship), 0);
        const standbySlots = Math.ceil(totalCrewPositions * exports.STANDBY_CREW_RATIO);
        return {
            totalCrewPositions,
            standbySlots,
            totalCapacity: totalCrewPositions + standbySlots,
        };
    }
    calculateMaintenanceHealth(ships) {
        const SUPPLY_CAPABLE_SIZES = new Set(['large', 'capital']);
        const AMMO_RATIO = 0.3;
        const FUEL_RATIO = 0.4;
        const REPAIR_RATIO = 0.3;
        const perShip = ships.map(ship => {
            const cargoScu = ship.cargo ?? 0;
            const sizeVal = (ship.size ?? 'small').toLowerCase();
            const isSupplyCapable = SUPPLY_CAPABLE_SIZES.has(sizeVal) && cargoScu > 0;
            const supplyCapacity = isSupplyCapable
                ? {
                    ammunition: Math.round(cargoScu * AMMO_RATIO),
                    fuel: Math.round(cargoScu * FUEL_RATIO),
                    repairMaterial: Math.round(cargoScu * REPAIR_RATIO),
                    totalAllocated: cargoScu,
                }
                : { ammunition: 0, fuel: 0, repairMaterial: 0, totalAllocated: 0 };
            return {
                shipId: ship.id,
                shipName: ship.name,
                size: sizeVal,
                status: ship.status,
                isFlightReady: ship.status === 'flight_ready',
                maxCrew: ship.maxCrew ?? ship.crew ?? 1,
                hullHp: ship.armor ?? 0,
                shieldHp: ship.shields ?? 0,
                cargoScu,
                isSupplyCapable,
                supplyCapacity,
            };
        });
        const flightReadyShips = perShip.filter(s => s.isFlightReady).length;
        const supplyCapableShips = perShip.filter(s => s.isSupplyCapable).length;
        const totalSupply = perShip.reduce((acc, s) => ({
            ammunition: acc.ammunition + s.supplyCapacity.ammunition,
            fuel: acc.fuel + s.supplyCapacity.fuel,
            repairMaterial: acc.repairMaterial + s.supplyCapacity.repairMaterial,
            totalScu: acc.totalScu + s.supplyCapacity.totalAllocated,
        }), { ammunition: 0, fuel: 0, repairMaterial: 0, totalScu: 0 });
        return {
            totalShips: ships.length,
            flightReadyShips,
            supplyCapableShips,
            totalSupply,
            perShip,
        };
    }
    computeCapabilityScore(ships) {
        let combatCapable = 0;
        let cargoCapable = 0;
        let totalCrew = 0;
        for (const ship of ships) {
            const role = (ship.role ?? '').toLowerCase();
            if (role.includes('combat') || role.includes('fighter') || role.includes('bomber')) {
                combatCapable++;
            }
            if (role.includes('cargo') || role.includes('freight') || role.includes('transport')) {
                cargoCapable++;
            }
            totalCrew += ship.maxCrew || 0;
        }
        const diversityFactors = [
            combatCapable > 0 ? 1 : 0,
            cargoCapable > 0 ? 1 : 0,
            totalCrew >= 5 ? 1 : 0,
            ships.length >= 3 ? 1 : 0,
        ];
        return (diversityFactors.reduce((s, v) => s + v, 0) / diversityFactors.length) * 100;
    }
    computeOperationalScore(fleet) {
        const ops = fleet.operationalStats;
        if (ops?.averageUptime !== null && ops?.averageUptime !== undefined) {
            return Math.min(ops.averageUptime, 100);
        }
        if (fleet.status === Fleet_1.FleetStatus.DEPLOYED) {
            return 100;
        }
        return 0;
    }
}
exports.FleetHealthService = FleetHealthService;
//# sourceMappingURL=FleetHealthService.js.map