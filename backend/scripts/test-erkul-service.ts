/**
 * End-to-end test: Verify ErkulGamesService.fetchShipList() works
 * with the new server.erkul.games API + session token.
 */
import { ErkulGamesService } from '../src/services/external/ErkulGamesService';

async function testFetchShipList(): Promise<void> {
  const service = new ErkulGamesService();
  console.log('Testing ErkulGamesService.fetchShipList()...\n');

  const result = await service.fetchShipList();

  console.log('success:', result.success);
  console.log('error:', result.error || 'none');
  console.log('fetchedAt:', result.fetchedAt?.toISOString());
  console.log('ships count:', result.ships?.length || 0);

  if (result.ships && result.ships.length > 0) {
    console.log('\n=== First 10 ships ===');
    result.ships.slice(0, 10).forEach((s, i) => {
      console.log(
        `${i + 1}. ${s.name} | mfr: ${s.manufacturer} | role: ${s.role || 'N/A'} | size: ${s.size || 'N/A'} | crew: ${s.crew ?? 'N/A'} | cargo: ${s.cargo ?? 'N/A'} | speed: ${s.speed ?? 'N/A'}`
      );
    });

    // Count vehicles vs spaceships
    const vehicles = result.ships.filter(s => s.isVehicle).length;
    const spaceships = result.ships.length - vehicles;
    console.log(`\nSpaceships: ${spaceships}, Ground vehicles: ${vehicles}`);

    // Unique manufacturers
    const mfrs = [...new Set(result.ships.map(s => s.manufacturer))].sort();
    console.log(`Manufacturers (${mfrs.length}): ${mfrs.join(', ')}`);
  }
}

testFetchShipList().catch(console.error);
