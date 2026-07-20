import { parseShipCSV, shipsToCSV, ParsedShip } from '@/utils/csvParser';

describe('csvParser', () => {
    describe('parseShipCSV', () => {
        it('should parse valid CSV with all fields', () => {
            const csv = `name,manufacturer,model,role,size,crew,cargoCapacity,location,status
Avenger Titan,Aegis Dynamics,Avenger Titan,multi-role,small,1,8,Port Olisar,operational`;
            
            const result = parseShipCSV(csv);
            
            expect(result.success).toBe(true);
            expect(result.ships).toHaveLength(1);
            expect(result.ships[0]).toEqual({
                name: 'Avenger Titan',
                manufacturer: 'Aegis Dynamics',
                model: 'Avenger Titan',
                role: 'multi-role',
                size: 'small',
                crew: 1,
                cargoCapacity: 8,
                location: 'Port Olisar',
                status: 'operational'
            });
            expect(result.errors).toHaveLength(0);
        });

        it('should parse CSV with only required fields', () => {
            const csv = `name,manufacturer,model,role,size
Gladius,Aegis Dynamics,Gladius,combat,small`;
            
            const result = parseShipCSV(csv);
            
            expect(result.success).toBe(true);
            expect(result.ships).toHaveLength(1);
            expect(result.ships[0]).toMatchObject({
                name: 'Gladius',
                manufacturer: 'Aegis Dynamics',
                model: 'Gladius',
                role: 'combat',
                size: 'small'
            });
            expect(result.ships[0].status).toBe('operational');
        });

        it('should parse multiple ships', () => {
            const csv = `name,manufacturer,model,role,size,crew
Gladius,Aegis Dynamics,Gladius,combat,small,1
Freelancer,MISC,Freelancer,cargo,medium,4
Reclaimer,Aegis Dynamics,Reclaimer,support,large,7`;
            
            const result = parseShipCSV(csv);
            
            expect(result.success).toBe(true);
            expect(result.ships).toHaveLength(3);
            expect(result.ships[0].name).toBe('Gladius');
            expect(result.ships[1].name).toBe('Freelancer');
            expect(result.ships[2].name).toBe('Reclaimer');
        });

        it('should handle quoted values with commas', () => {
            const csv = `name,manufacturer,model,role,size
"Aurora MR, Modified",Roberts Space Industries,Aurora MR,multi-role,small`;
            
            const result = parseShipCSV(csv);
            
            expect(result.success).toBe(true);
            expect(result.ships).toHaveLength(1);
            expect(result.ships[0].name).toBe('Aurora MR, Modified');
        });

        it('should skip empty lines', () => {
            const csv = `name,manufacturer,model,role,size
Gladius,Aegis Dynamics,Gladius,combat,small

Freelancer,MISC,Freelancer,cargo,medium`;
            
            const result = parseShipCSV(csv);
            
            expect(result.success).toBe(true);
            expect(result.ships).toHaveLength(2);
        });

        it('should fail if required headers are missing', () => {
            const csv = `name,manufacturer,model
Gladius,Aegis Dynamics,Gladius`;
            
            const result = parseShipCSV(csv);
            
            expect(result.success).toBe(false);
            expect(result.errors).toContain('Missing required columns: role, size');
        });

        it('should fail on empty CSV', () => {
            const csv = '';
            
            const result = parseShipCSV(csv);
            
            expect(result.success).toBe(false);
            expect(result.errors.length).toBeGreaterThan(0);
        });

        it('should report error for invalid size', () => {
            const csv = `name,manufacturer,model,role,size
Gladius,Aegis Dynamics,Gladius,combat,invalid`;
            
            const result = parseShipCSV(csv);
            
            expect(result.success).toBe(false);
            expect(result.errors.length).toBeGreaterThan(0);
            expect(result.errors[0]).toContain('Invalid size');
        });

        it('should report error for invalid crew number', () => {
            const csv = `name,manufacturer,model,role,size,crew
Gladius,Aegis Dynamics,Gladius,combat,small,invalid`;
            
            const result = parseShipCSV(csv);
            
            expect(result.success).toBe(false);
            expect(result.errors.length).toBeGreaterThan(0);
            expect(result.errors[0]).toContain('Invalid crew value');
        });

        it('should report error for missing required field', () => {
            const csv = `name,manufacturer,model,role,size
,Aegis Dynamics,Gladius,combat,small`;
            
            const result = parseShipCSV(csv);
            
            expect(result.success).toBe(false);
            expect(result.errors.length).toBeGreaterThan(0);
            expect(result.errors[0]).toContain('Name is required');
        });

        it('should handle column count mismatch', () => {
            const csv = `name,manufacturer,model,role,size
Gladius,Aegis Dynamics,Gladius,combat`;
            
            const result = parseShipCSV(csv);
            
            expect(result.success).toBe(false);
            expect(result.errors.length).toBeGreaterThan(0);
            expect(result.errors[0]).toContain('Column count mismatch');
        });

        it('should parse case-insensitive column headers', () => {
            const csv = `NAME,MANUFACTURER,MODEL,ROLE,SIZE
Gladius,Aegis Dynamics,Gladius,combat,small`;
            
            const result = parseShipCSV(csv);
            
            expect(result.success).toBe(true);
            expect(result.ships).toHaveLength(1);
            expect(result.ships[0].name).toBe('Gladius');
        });

        it('should accept cargo or cargocapacity column', () => {
            const csv1 = `name,manufacturer,model,role,size,cargo
Gladius,Aegis Dynamics,Gladius,combat,small,100`;
            
            const result1 = parseShipCSV(csv1);
            
            expect(result1.success).toBe(true);
            expect(result1.ships[0].cargoCapacity).toBe(100);

            const csv2 = `name,manufacturer,model,role,size,cargoCapacity
Gladius,Aegis Dynamics,Gladius,combat,small,100`;
            
            const result2 = parseShipCSV(csv2);
            
            expect(result2.success).toBe(true);
            expect(result2.ships[0].cargoCapacity).toBe(100);
        });
    });

    describe('shipsToCSV', () => {
        it('should convert ships to CSV format', () => {
            const ships: ParsedShip[] = [
                {
                    name: 'Gladius',
                    manufacturer: 'Aegis Dynamics',
                    model: 'Gladius',
                    role: 'combat',
                    size: 'small',
                    crew: 1,
                    cargoCapacity: 0,
                    location: 'Port Olisar',
                    status: 'operational'
                }
            ];
            
            const csv = shipsToCSV(ships);
            
            expect(csv).toContain('name,manufacturer,model,role,size,crew,cargoCapacity,location,status');
            expect(csv).toContain('Gladius,Aegis Dynamics,Gladius,combat,small,1,0,Port Olisar,operational');
        });

        it('should handle ships with missing optional fields', () => {
            const ships: ParsedShip[] = [
                {
                    name: 'Gladius',
                    manufacturer: 'Aegis Dynamics',
                    model: 'Gladius',
                    role: 'combat',
                    size: 'small'
                }
            ];
            
            const csv = shipsToCSV(ships);
            
            expect(csv).toContain('Gladius,Aegis Dynamics,Gladius,combat,small,,,');
        });

        it('should escape values with commas', () => {
            const ships: ParsedShip[] = [
                {
                    name: 'Aurora MR, Modified',
                    manufacturer: 'RSI',
                    model: 'Aurora',
                    role: 'multi-role',
                    size: 'small'
                }
            ];
            
            const csv = shipsToCSV(ships);
            
            expect(csv).toContain('"Aurora MR, Modified"');
        });

        it('should handle multiple ships', () => {
            const ships: ParsedShip[] = [
                {
                    name: 'Gladius',
                    manufacturer: 'Aegis Dynamics',
                    model: 'Gladius',
                    role: 'combat',
                    size: 'small'
                },
                {
                    name: 'Freelancer',
                    manufacturer: 'MISC',
                    model: 'Freelancer',
                    role: 'cargo',
                    size: 'medium'
                }
            ];
            
            const csv = shipsToCSV(ships);
            const lines = csv.split('\n');
            
            expect(lines).toHaveLength(3); // Header + 2 ships
            expect(lines[1]).toContain('Gladius');
            expect(lines[2]).toContain('Freelancer');
        });
    });

    describe('round-trip conversion', () => {
        it('should preserve data through CSV export and import', () => {
            const originalShips: ParsedShip[] = [
                {
                    name: 'Gladius',
                    manufacturer: 'Aegis Dynamics',
                    model: 'Gladius',
                    role: 'combat',
                    size: 'small',
                    crew: 1,
                    cargoCapacity: 0,
                    location: 'Port Olisar',
                    status: 'operational'
                },
                {
                    name: 'Freelancer MAX',
                    manufacturer: 'MISC',
                    model: 'Freelancer',
                    role: 'cargo',
                    size: 'medium',
                    crew: 4,
                    cargoCapacity: 120,
                    status: 'operational'
                }
            ];
            
            const csv = shipsToCSV(originalShips);
            const result = parseShipCSV(csv);
            
            expect(result.success).toBe(true);
            expect(result.ships).toHaveLength(2);
            expect(result.ships[0]).toEqual(originalShips[0]);
            expect(result.ships[1]).toEqual(originalShips[1]);
        });
    });
});
