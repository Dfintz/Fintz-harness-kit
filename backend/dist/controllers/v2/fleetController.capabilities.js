"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.matchesCapability = matchesCapability;
exports.aggregateShipCapabilities = aggregateShipCapabilities;
exports.batchShipCounts = batchShipCounts;
exports.batchMemberCounts = batchMemberCounts;
exports.computeFleetCapabilities = computeFleetCapabilities;
const database_1 = require("../../config/database");
const FleetShip_1 = require("../../models/FleetShip");
const RouteCalculationService_1 = require("../../services/activity/RouteCalculationService");
const logger_1 = require("../../utils/logger");
function matchesCapability(nameLower, capList) {
    return capList.some(c => nameLower.includes(c));
}
function aggregateShipCapabilities(ships) {
    let totalCargo = 0;
    let totalQF = 0;
    let qfCount = 0;
    let hasRefuel = false;
    let hasRearm = false;
    let hasRepair = false;
    let hasMedical = false;
    const refuelShipNames = [];
    const rearmShipNames = [];
    const repairShipNames = [];
    const medicalShipNames = [];
    for (const ship of ships) {
        totalCargo += ship.cargo ?? 0;
        if (ship.quantumFuelCapacity) {
            totalQF += ship.quantumFuelCapacity;
            qfCount++;
        }
        const nameLower = ship.name.toLowerCase();
        if (matchesCapability(nameLower, RouteCalculationService_1.RouteCalculationService.REFUEL_SHIPS)) {
            hasRefuel = true;
            refuelShipNames.push(ship.name);
        }
        if (matchesCapability(nameLower, RouteCalculationService_1.RouteCalculationService.REARM_SHIPS)) {
            hasRearm = true;
            rearmShipNames.push(ship.name);
        }
        if (matchesCapability(nameLower, RouteCalculationService_1.RouteCalculationService.REPAIR_SHIPS)) {
            hasRepair = true;
            repairShipNames.push(ship.name);
        }
        if (matchesCapability(nameLower, RouteCalculationService_1.RouteCalculationService.MEDICAL_SHIPS)) {
            hasMedical = true;
            medicalShipNames.push(ship.name);
        }
    }
    return {
        totalCargoCapacity: totalCargo,
        avgQuantumFuel: qfCount > 0 ? totalQF / qfCount : null,
        hasRefuelShip: hasRefuel,
        hasRearmShip: hasRearm,
        hasRepairShip: hasRepair,
        hasMedicalShip: hasMedical,
        refuelShipNames,
        rearmShipNames,
        repairShipNames,
        medicalShipNames,
    };
}
async function batchShipCounts(fleetIds) {
    const result = new Map();
    if (fleetIds.length === 0) {
        return result;
    }
    try {
        const fleetShipRepo = database_1.AppDataSource.getRepository(FleetShip_1.FleetShip);
        const rows = await fleetShipRepo
            .createQueryBuilder('fs')
            .select('fs.fleetId', 'fleetId')
            .addSelect('COUNT(*)::int', 'count')
            .innerJoin('fs.ship', 'ship')
            .where('fs.fleetId IN (:...fleetIds)', { fleetIds })
            .groupBy('fs.fleetId')
            .getRawMany();
        for (const row of rows) {
            result.set(row.fleetId, row.count);
        }
    }
    catch (error) {
        logger_1.logger.error('Error loading ship counts:', error);
    }
    return result;
}
async function batchMemberCounts(fleets, organizationId) {
    const result = new Map();
    const teamToFleets = new Map();
    for (const fleet of fleets) {
        if (fleet.teamId) {
            const existing = teamToFleets.get(fleet.teamId) ?? [];
            existing.push(fleet.id);
            teamToFleets.set(fleet.teamId, existing);
        }
    }
    if (teamToFleets.size === 0) {
        return result;
    }
    try {
        const teamIds = Array.from(teamToFleets.keys());
        const rows = await database_1.AppDataSource.query(`SELECT "teamId", COUNT(*)::int AS "count"
       FROM team_members
       WHERE "teamId" = ANY($1)
         AND "organizationId" = $2
         AND status IN ('active', 'deployed')
       GROUP BY "teamId"`, [teamIds, organizationId]);
        for (const row of rows) {
            const fleetIds = teamToFleets.get(row.teamId);
            if (fleetIds) {
                for (const fleetId of fleetIds) {
                    result.set(fleetId, row.count);
                }
            }
        }
    }
    catch (error) {
        logger_1.logger.error('Error loading member counts:', error);
    }
    return result;
}
async function computeFleetCapabilities(fleetIds) {
    const result = new Map();
    if (fleetIds.length === 0) {
        return result;
    }
    const defaultCaps = {
        totalCargoCapacity: 0,
        avgQuantumFuel: null,
        hasRefuelShip: false,
        hasRearmShip: false,
        hasRepairShip: false,
        hasMedicalShip: false,
        refuelShipNames: [],
        rearmShipNames: [],
        repairShipNames: [],
        medicalShipNames: [],
    };
    for (const id of fleetIds) {
        result.set(id, { ...defaultCaps });
    }
    try {
        const fleetShipRepo = database_1.AppDataSource.getRepository(FleetShip_1.FleetShip);
        const rows = await fleetShipRepo
            .createQueryBuilder('fs')
            .innerJoinAndSelect('fs.ship', 'ship')
            .where('fs.fleetId IN (:...ids)', { ids: fleetIds })
            .getMany();
        const fleetShips = new Map();
        for (const row of rows) {
            const arr = fleetShips.get(row.fleetId) ?? [];
            arr.push(row.ship);
            fleetShips.set(row.fleetId, arr);
        }
        for (const [fleetId, ships] of fleetShips) {
            result.set(fleetId, aggregateShipCapabilities(ships));
        }
    }
    catch (error) {
        logger_1.logger.error('Error computing fleet capabilities:', error);
    }
    return result;
}
//# sourceMappingURL=fleetController.capabilities.js.map