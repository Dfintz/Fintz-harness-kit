"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveShipIds = resolveShipIds;
const database_1 = require("../../config/database");
const OrganizationShip_1 = require("../../models/OrganizationShip");
const Ship_1 = require("../../models/Ship");
const UserShip_1 = require("../../models/UserShip");
async function resolveShipIds(shipIds, organizationId) {
    const orgShipRepo = database_1.AppDataSource.getRepository(OrganizationShip_1.OrganizationShip);
    const userShipRepo = database_1.AppDataSource.getRepository(UserShip_1.UserShip);
    const shipRepo = database_1.AppDataSource.getRepository(Ship_1.Ship);
    const orgShips = await orgShipRepo
        .createQueryBuilder('os')
        .where('os.id IN (:...shipIds)', { shipIds })
        .andWhere('os.organizationId = :organizationId', { organizationId })
        .getMany();
    const resolved = new Map();
    for (const orgShip of orgShips) {
        resolved.set(orgShip.id, orgShip.shipId);
    }
    const unresolvedIds = shipIds.filter(id => !resolved.has(id));
    if (unresolvedIds.length > 0) {
        const userShips = await userShipRepo
            .createQueryBuilder('us')
            .where('us.id IN (:...unresolvedIds)', { unresolvedIds })
            .andWhere('us.shipId IS NOT NULL')
            .getMany();
        for (const userShip of userShips) {
            if (userShip.shipId) {
                resolved.set(userShip.id, userShip.shipId);
            }
        }
    }
    const stillUnresolved = shipIds.filter(id => !resolved.has(id));
    if (stillUnresolved.length > 0) {
        const catalogShips = await shipRepo
            .createQueryBuilder('s')
            .where('s.id IN (:...stillUnresolved)', { stillUnresolved })
            .getMany();
        for (const ship of catalogShips) {
            resolved.set(ship.id, ship.id);
        }
    }
    return resolved;
}
//# sourceMappingURL=fleetController.shipResolution.js.map