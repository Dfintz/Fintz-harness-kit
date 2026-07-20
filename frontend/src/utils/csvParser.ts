/**
 * CSV Parser Utility
 * Handles parsing CSV files for ship import
 */

export interface ParsedShip {
    name: string;
    manufacturer: string;
    model: string;
    role: string;
    size: 'vehicle' | 'snub' | 'small' | 'medium' | 'large' | 'sub_capital' | 'capital';
    crew?: number;
    cargoCapacity?: number;
    location?: string;
    status?: 'operational' | 'maintenance' | 'damaged' | 'destroyed';
}

export interface CSVParseResult {
    success: boolean;
    ships: ParsedShip[];
    errors: string[];
}

/**
 * Parse CSV content into ship objects
 * Expected CSV format:
 * name,manufacturer,model,role,size,crew,cargoCapacity,location,status
 */
export function parseShipCSV(csvContent: string): CSVParseResult {
    const errors: string[] = [];
    const ships: ParsedShip[] = [];

    try {
        const lines = csvContent.trim().split('\n');
        
        if (lines.length === 0) {
            return { success: false, ships: [], errors: ['CSV file is empty'] };
        }

        // Parse header
        const headerLine = lines[0].trim();
        const headers = parseCSVLine(headerLine).map(h => h.trim().toLowerCase());
        
        // Validate required headers
        const requiredHeaders = ['name', 'manufacturer', 'model', 'role', 'size'];
        const missingHeaders = requiredHeaders.filter(h => !headers.includes(h));
        
        if (missingHeaders.length > 0) {
            return {
                success: false,
                ships: [],
                errors: [`Missing required columns: ${missingHeaders.join(', ')}`]
            };
        }

        // Parse data rows
        for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue; // Skip empty lines

            const values = parseCSVLine(line);
            
            if (values.length !== headers.length) {
                errors.push(`Line ${i + 1}: Column count mismatch (expected ${headers.length}, got ${values.length})`);
                continue;
            }

            try {
                const ship = parseShipFromCSVRow(headers, values, i + 1);
                ships.push(ship);
            } catch (error) {
                errors.push(`Line ${i + 1}: ${(error as Error).message}`);
            }
        }

        return {
            success: ships.length > 0,
            ships,
            errors
        };
    } catch (error) {
        return {
            success: false,
            ships: [],
            errors: [`Failed to parse CSV: ${(error as Error).message}`]
        };
    }
}

/**
 * Parse a single CSV line, handling quoted values
 */
function parseCSVLine(line: string): string[] {
    const values: string[] = [];
    let currentValue = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const char = line[i];

        if (char === '"') {
            inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
            values.push(currentValue.trim());
            currentValue = '';
        } else {
            currentValue += char;
        }
    }

    values.push(currentValue.trim());
    return values;
}

/**
 * Parse ship data from CSV row
 */
function parseShipFromCSVRow(headers: string[], values: string[], _lineNumber: number): ParsedShip {
    const getValueByHeader = (header: string): string => {
        const index = headers.indexOf(header);
        return index >= 0 ? values[index] : '';
    };

    const name = getValueByHeader('name');
    const manufacturer = getValueByHeader('manufacturer');
    const model = getValueByHeader('model');
    const role = getValueByHeader('role');
    const sizeStr = getValueByHeader('size').toLowerCase();

    // Validate required fields
    if (!name) throw new Error('Name is required');
    if (!manufacturer) throw new Error('Manufacturer is required');
    if (!model) throw new Error('Model is required');
    if (!role) throw new Error('Role is required');
    if (!sizeStr) throw new Error('Size is required');

    // Validate size
    const validSizes = ['vehicle', 'snub', 'small', 'medium', 'large', 'sub_capital', 'capital'];
    if (!validSizes.includes(sizeStr)) {
        throw new Error(`Invalid size '${sizeStr}'. Must be one of: ${validSizes.join(', ')}`);
    }
    const size = sizeStr as 'vehicle' | 'snub' | 'small' | 'medium' | 'large' | 'sub_capital' | 'capital';

    // Parse optional fields
    const crewStr = getValueByHeader('crew');
    const crew = crewStr ? parseInt(crewStr, 10) : undefined;
    if (crewStr && (isNaN(crew!) || crew! < 0)) {
        throw new Error(`Invalid crew value '${crewStr}'. Must be a non-negative number`);
    }

    const cargoStr = getValueByHeader('cargocapacity') || getValueByHeader('cargo');
    const cargoCapacity = cargoStr ? parseInt(cargoStr, 10) : undefined;
    if (cargoStr && (isNaN(cargoCapacity!) || cargoCapacity! < 0)) {
        throw new Error(`Invalid cargo capacity '${cargoStr}'. Must be a non-negative number`);
    }

    const location = getValueByHeader('location') || undefined;

    const statusStr = getValueByHeader('status').toLowerCase();
    const validStatuses = ['operational', 'maintenance', 'damaged', 'destroyed'];
    let status: 'operational' | 'maintenance' | 'damaged' | 'destroyed' | undefined;
    
    if (statusStr) {
        if (!validStatuses.includes(statusStr)) {
            throw new Error(`Invalid status '${statusStr}'. Must be one of: ${validStatuses.join(', ')}`);
        }
        status = statusStr as 'operational' | 'maintenance' | 'damaged' | 'destroyed';
    }

    return {
        name,
        manufacturer,
        model,
        role,
        size,
        crew,
        cargoCapacity,
        location,
        status: status || 'operational'
    };
}

/**
 * Convert parsed ships to CSV format
 */
export function shipsToCSV(ships: ParsedShip[]): string {
    const headers = ['name', 'manufacturer', 'model', 'role', 'size', 'crew', 'cargoCapacity', 'location', 'status'];
    const lines = [headers.join(',')];

    for (const ship of ships) {
        const values = [
            escapeCSVValue(ship.name),
            escapeCSVValue(ship.manufacturer),
            escapeCSVValue(ship.model),
            escapeCSVValue(ship.role),
            escapeCSVValue(ship.size),
            ship.crew?.toString() || '',
            ship.cargoCapacity?.toString() || '',
            ship.location ? escapeCSVValue(ship.location) : '',
            ship.status || 'operational'
        ];
        lines.push(values.join(','));
    }

    return lines.join('\n');
}

/**
 * Escape CSV value if it contains special characters
 */
function escapeCSVValue(value: string): string {
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
        return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
}
