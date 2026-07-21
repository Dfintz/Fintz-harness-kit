import { AppDataSource } from '../../config/database';
import { OrganizationShip } from '../../models/OrganizationShip';
import { Ship } from '../../models/Ship';
import { UserShip } from '../../models/UserShip';

/**
 * Resolve ship IDs from OrganizationShip/UserShip tables to catalog Ship IDs.
 */
export async function resolveShipIds(
  shipIds: string[],
  organizationId: string
): Promise<Map<string, string>> {
  const orgShipRepo = AppDataSource.getRepository(OrganizationShip);
  const userShipRepo = AppDataSource.getRepository(UserShip);
  const shipRepo = AppDataSource.getRepository(Ship);

  // Try OrganizationShip first
  const orgShips = await orgShipRepo
    .createQueryBuilder('os')
    .where('os.id IN (:...shipIds)', { shipIds })
    .andWhere('os.organizationId = :organizationId', { organizationId })
    .getMany();

  const resolved = new Map<string, string>();
  for (const orgShip of orgShips) {
    resolved.set(orgShip.id, orgShip.shipId);
  }

  // Check remaining IDs against UserShip (member-shared ships)
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

  // Fallback: check if remaining IDs are catalog Ship IDs directly
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
