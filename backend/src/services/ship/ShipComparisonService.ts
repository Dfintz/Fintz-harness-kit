import { AppDataSource } from '../../data-source';
import { Ship, ShipSize } from '../../models/Ship';
import { logger } from '../../utils/logger';

// Scoring constants
const DEFAULT_VALUE_SCORE = 50;
const DEFAULT_CREW_SCORE = 50;

// Value calculation weights
const CARGO_VALUE_WEIGHT = 0.1;
const SPEED_VALUE_WEIGHT = 0.01;
const SHIELDS_VALUE_WEIGHT = 0.1;

export interface ShipComparisonResult {
    ships: ShipComparisonData[];
    categories: ComparisonCategory[];
    summary: ComparisonSummary;
}

export interface ShipComparisonData {
    ship: Ship;
    scores: {
        combat: number;
        cargo: number;
        speed: number;
        crew: number;
        value: number;
        overall: number;
    };
    rankings: {
        [category: string]: number;
    };
}

export interface ComparisonCategory {
    name: string;
    metrics: ComparisonMetric[];
}

export interface ComparisonMetric {
    name: string;
    unit?: string;
    values: { shipId: string; value: number | string | null; isWinner: boolean }[];
    higherIsBetter: boolean;
}

export interface ComparisonSummary {
    totalShips: number;
    bestForCombat?: string;
    bestForCargo?: string;
    bestForSpeed?: string;
    bestValue?: string;
    recommendations: ShipRecommendation[];
}

export interface ShipRecommendation {
    shipId: string;
    shipName: string;
    strength: string;
    reason: string;
}

export interface ShipRoleAnalysis {
    shipId: string;
    shipName: string;
    primaryRoles: string[];
    capabilities: {
        role: string;
        score: number;
        description: string;
    }[];
    bestFor: string[];
    limitations: string[];
}

export interface FleetCompositionAnalysis {
    ships: Ship[];
    roleDistribution: Record<string, number>;
    sizeDistribution: Record<string, number>;
    capabilities: {
        hasCombat: boolean;
        hasCargo: boolean;
        hasExploration: boolean;
        hasMining: boolean;
        hasMedical: boolean;
        hasMultiCrew: boolean;
    };
    gaps: string[];
    recommendations: string[];
    overallScore: number;
}

/**
 * ShipComparisonService - Ship comparison and analysis tools
 * 
 * Features:
 * - Side-by-side ship comparison
 * - Performance scoring
 * - Role analysis
 * - Fleet composition analysis
 * - Ship recommendations
 */
export class ShipComparisonService {
    private shipRepository = AppDataSource.getRepository(Ship);

    /**
     * Compare multiple ships side by side
     */
    async compareShips(shipIds: string[]): Promise<ShipComparisonResult> {
        logger.info('ShipComparisonService.compareShips', { shipCount: shipIds.length });

        if (shipIds.length < 2) {
            throw new Error('At least 2 ships are required for comparison');
        }

        // Fetch ships
        const ships = await this.shipRepository
            .createQueryBuilder('ship')
            .where('ship.id IN (:...ids)', { ids: shipIds })
            .getMany();

        if (ships.length < 2) {
            throw new Error('Could not find enough ships for comparison');
        }

        // Calculate scores for each ship
        const shipData: ShipComparisonData[] = ships.map(ship => ({
            ship,
            scores: this.calculateShipScores(ship),
            rankings: {}
        }));

        // Calculate rankings
        this.calculateRankings(shipData);

        // Build comparison categories
        const categories = this.buildComparisonCategories(ships);

        // Build summary
        const summary = this.buildComparisonSummary(shipData);

        return {
            ships: shipData,
            categories,
            summary
        };
    }

    /**
     * Calculate performance scores for a ship
     */
    private calculateShipScores(ship: Ship): ShipComparisonData['scores'] {
        const combat = this.calculateCombatScore(ship);
        const cargo = this.calculateCargoScore(ship);
        const speed = this.calculateSpeedScore(ship);
        const crew = this.calculateCrewScore(ship);
        const value = this.calculateValueScore(ship);

        const overall = (combat + cargo + speed + crew + value) / 5;

        return { combat, cargo, speed, crew, value, overall };
    }

    /**
     * Calculate combat effectiveness score (0-100)
     */
    private calculateCombatScore(ship: Ship): number {
        let score = 0;

        // Weapons contribution
        if (ship.weapons && ship.weapons.length > 0) {
            const weaponScore = ship.weapons.reduce((acc, w) => acc + (w.size * w.count * 10), 0);
            score += Math.min(weaponScore, 40);
        }

        // Shield contribution
        if (ship.shields) {
            score += Math.min(ship.shields / 10, 30);
        }

        // Size factor (larger ships generally have more firepower)
        if (ship.size) {
            const sizeScores: Record<string, number> = {
                [ShipSize.VEHICLE]: 5,
                [ShipSize.SNUB]: 10,
                [ShipSize.SMALL]: 15,
                [ShipSize.MEDIUM]: 20,
                [ShipSize.LARGE]: 25,
                [ShipSize.CAPITAL]: 30
            };
            score += sizeScores[ship.size] || 10;
        }

        return Math.min(Math.round(score), 100);
    }

    /**
     * Calculate cargo capacity score (0-100)
     */
    private calculateCargoScore(ship: Ship): number {
        let score = 0;

        if (ship.cargo) {
            // Normalize cargo capacity (assuming max practical is 10000 SCU)
            score = Math.min((ship.cargo / 10000) * 100, 100);
        }

        if (ship.vehicleCargo) {
            score += Math.min((ship.vehicleCargo / 100) * 10, 10);
        }

        return Math.round(score);
    }

    /**
     * Calculate speed score (0-100)
     */
    private calculateSpeedScore(ship: Ship): number {
        let score = 0;

        if (ship.speed) {
            // Normalize speed (assuming max is 1400 m/s)
            score += (ship.speed / 1400) * 40;
        }

        if (ship.afterburnerSpeed) {
            score += (ship.afterburnerSpeed / 1400) * 30;
        }

        if (ship.quantumSpeed) {
            // Normalize quantum speed (max around 300,000 km/s)
            score += (ship.quantumSpeed / 300000) * 30;
        }

        return Math.round(Math.min(score, 100));
    }

    /**
     * Calculate crew efficiency score (0-100)
     */
    private calculateCrewScore(ship: Ship): number {
        let score = DEFAULT_CREW_SCORE; // Base score

        if (ship.minCrew && ship.maxCrew) {
            // Ships that work well with minimal crew score higher
            const flexibility = ship.maxCrew > 0 ? (1 - (ship.minCrew / ship.maxCrew)) * 30 : 0;
            score += flexibility;
        }

        // Solo-capable ships get a bonus
        if (ship.minCrew === 1) {
            score += 20;
        }

        return Math.round(Math.min(score, 100));
    }

    /**
     * Calculate value score (price vs capability)
     */
    private calculateValueScore(ship: Ship): number {
        if (!ship.price) {return DEFAULT_VALUE_SCORE;}

        const price = Number(ship.price);
        
        // Calculate capability per credit
        let capability = 0;
        
        if (ship.cargo) {capability += ship.cargo * CARGO_VALUE_WEIGHT;}
        if (ship.speed) {capability += ship.speed * SPEED_VALUE_WEIGHT;}
        if (ship.shields) {capability += ship.shields * SHIELDS_VALUE_WEIGHT;}

        // Higher capability per price = better value
        const valueRatio = capability / (price / 10000);
        
        return Math.round(Math.min(valueRatio * 10, 100));
    }

    /**
     * Calculate rankings within the comparison set
     */
    private calculateRankings(shipData: ShipComparisonData[]): void {
        const categories: (keyof ShipComparisonData['scores'])[] = ['combat', 'cargo', 'speed', 'crew', 'value', 'overall'];

        for (const category of categories) {
            // Sort by score descending
            const sorted = [...shipData].sort((a, b) => 
                b.scores[category] - a.scores[category]
            );

            // Assign rankings
            sorted.forEach((data, index) => {
                data.rankings[category] = index + 1;
            });
        }
    }

    /**
     * Build detailed comparison categories
     */
    private buildComparisonCategories(ships: Ship[]): ComparisonCategory[] {
        return [
            {
                name: 'Performance',
                metrics: [
                    this.buildMetric('Speed', 'm/s', ships, 'speed', true),
                    this.buildMetric('Afterburner Speed', 'm/s', ships, 'afterburnerSpeed', true),
                    this.buildMetric('Quantum Speed', 'km/s', ships, 'quantumSpeed', true)
                ]
            },
            {
                name: 'Capacity',
                metrics: [
                    this.buildMetric('Cargo', 'SCU', ships, 'cargo', true),
                    this.buildMetric('Vehicle Cargo', 'units', ships, 'vehicleCargo', true),
                    this.buildMetric('Crew (Min)', 'persons', ships, 'minCrew', false),
                    this.buildMetric('Crew (Max)', 'persons', ships, 'maxCrew', true)
                ]
            },
            {
                name: 'Combat',
                metrics: [
                    this.buildMetric('Shields', 'HP', ships, 'shields', true),
                    this.buildMetric('Armor', 'points', ships, 'armor', true)
                ]
            },
            {
                name: 'Fuel',
                metrics: [
                    this.buildMetric('Quantum Fuel', 'units', ships, 'quantumFuelCapacity', true),
                    this.buildMetric('Hydrogen Fuel', 'units', ships, 'hydrogenFuelCapacity', true)
                ]
            },
            {
                name: 'Dimensions',
                metrics: [
                    this.buildMetric('Length', 'm', ships, 'length', false),
                    this.buildMetric('Beam', 'm', ships, 'beam', false),
                    this.buildMetric('Height', 'm', ships, 'height', false),
                    this.buildMetric('Mass', 'kg', ships, 'mass', false)
                ]
            },
            {
                name: 'Cost',
                metrics: [
                    this.buildMetric('In-Game Price', 'aUEC', ships, 'price', false),
                    this.buildMetric('Pledge Price', 'USD', ships, 'pledgePrice', false)
                ]
            }
        ];
    }

    /**
     * Build a comparison metric
     */
    private buildMetric(
        name: string, 
        unit: string, 
        ships: Ship[], 
        property: keyof Ship,
        higherIsBetter: boolean
    ): ComparisonMetric {
        const values = ships.map(ship => ({
            shipId: ship.id,
            value: ship[property] as number | string | null,
            isWinner: false
        }));

        // Determine winner
        const numericValues = values.filter(v => typeof v.value === 'number');
        if (numericValues.length > 0) {
            const sorted = [...numericValues].sort((a, b) => {
                const aVal = a.value as number;
                const bVal = b.value as number;
                return higherIsBetter ? bVal - aVal : aVal - bVal;
            });
            
            const winnerId = sorted[0].shipId;
            values.forEach(v => {
                if (v.shipId === winnerId && v.value !== null) {
                    v.isWinner = true;
                }
            });
        }

        return { name, unit, values, higherIsBetter };
    }

    /**
     * Build comparison summary with recommendations
     */
    private buildComparisonSummary(shipData: ShipComparisonData[]): ComparisonSummary {
        const summary: ComparisonSummary = {
            totalShips: shipData.length,
            recommendations: []
        };

        // Find best in each category
        for (const data of shipData) {
            if (data.rankings.combat === 1) {
                summary.bestForCombat = data.ship.id;
                summary.recommendations.push({
                    shipId: data.ship.id,
                    shipName: data.ship.name,
                    strength: 'Combat',
                    reason: `Highest combat score (${data.scores.combat}/100)`
                });
            }
            if (data.rankings.cargo === 1) {
                summary.bestForCargo = data.ship.id;
                summary.recommendations.push({
                    shipId: data.ship.id,
                    shipName: data.ship.name,
                    strength: 'Cargo',
                    reason: `Best cargo capacity (${data.ship.cargo || 0} SCU)`
                });
            }
            if (data.rankings.speed === 1) {
                summary.bestForSpeed = data.ship.id;
                summary.recommendations.push({
                    shipId: data.ship.id,
                    shipName: data.ship.name,
                    strength: 'Speed',
                    reason: `Fastest ship (${data.ship.speed || 0} m/s)`
                });
            }
            if (data.rankings.value === 1) {
                summary.bestValue = data.ship.id;
                summary.recommendations.push({
                    shipId: data.ship.id,
                    shipName: data.ship.name,
                    strength: 'Value',
                    reason: 'Best capability to price ratio'
                });
            }
        }

        return summary;
    }

    /**
     * Analyze ship roles and capabilities
     */
    async analyzeShipRoles(shipId: string): Promise<ShipRoleAnalysis> {
        logger.info('ShipComparisonService.analyzeShipRoles', { shipId });

        const ship = await this.shipRepository.findOne({ where: { id: shipId } });
        if (!ship) {
            throw new Error('Ship not found');
        }

        const capabilities: ShipRoleAnalysis['capabilities'] = [];
        const bestFor: string[] = [];
        const limitations: string[] = [];

        // Analyze combat capability
        const combatScore = this.calculateCombatScore(ship);
        capabilities.push({
            role: 'Combat',
            score: combatScore,
            description: combatScore >= 70 ? 'Excellent combat capability' :
                         combatScore >= 40 ? 'Moderate combat capability' :
                         'Limited combat capability'
        });
        if (combatScore >= 70) {bestFor.push('Combat missions');}
        if (combatScore < 30) {limitations.push('Not suited for heavy combat');}

        // Analyze cargo capability
        const cargoScore = this.calculateCargoScore(ship);
        capabilities.push({
            role: 'Cargo',
            score: cargoScore,
            description: cargoScore >= 70 ? 'Excellent cargo capacity' :
                         cargoScore >= 40 ? 'Moderate cargo capacity' :
                         'Limited cargo capacity'
        });
        if (cargoScore >= 70) {bestFor.push('Trading and hauling');}
        if (cargoScore < 20) {limitations.push('Minimal cargo space');}

        // Analyze exploration capability
        const hasQuantumFuel = ship.quantumFuelCapacity && ship.quantumFuelCapacity > 1000;
        const hasSpeed = ship.quantumSpeed && ship.quantumSpeed > 100000;
        const explorationScore = (hasQuantumFuel ? 50 : 0) + (hasSpeed ? 50 : 0);
        capabilities.push({
            role: 'Exploration',
            score: explorationScore,
            description: explorationScore >= 70 ? 'Well-suited for exploration' :
                         explorationScore >= 40 ? 'Can handle some exploration' :
                         'Not ideal for long-range exploration'
        });
        if (explorationScore >= 70) {bestFor.push('Exploration');}

        // Analyze multi-crew
        const crewCapacity = ship.maxCrew || 1;
        const multiCrewScore = Math.min((crewCapacity / 10) * 100, 100);
        capabilities.push({
            role: 'Multi-Crew',
            score: multiCrewScore,
            description: crewCapacity >= 5 ? 'Full multi-crew experience' :
                         crewCapacity >= 2 ? 'Some multi-crew capability' :
                         'Solo ship'
        });
        if (crewCapacity >= 5) {bestFor.push('Group gameplay');}
        if (crewCapacity === 1) {limitations.push('Solo only');}

        // Determine primary roles from ship data
        const primaryRoles: string[] = [];
        if (ship.role) {primaryRoles.push(ship.role);}
        if (ship.roles) {primaryRoles.push(...ship.roles);}

        return {
            shipId: ship.id,
            shipName: ship.name,
            primaryRoles,
            capabilities,
            bestFor,
            limitations
        };
    }

    /**
     * Analyze fleet composition and provide recommendations
     */
    async analyzeFleetComposition(shipIds: string[]): Promise<FleetCompositionAnalysis> {
        logger.info('ShipComparisonService.analyzeFleetComposition', { shipCount: shipIds.length });

        const ships = await this.shipRepository
            .createQueryBuilder('ship')
            .where('ship.id IN (:...ids)', { ids: shipIds })
            .getMany();

        const roleDistribution: Record<string, number> = {};
        const sizeDistribution: Record<string, number> = {};
        const capabilities = {
            hasCombat: false,
            hasCargo: false,
            hasExploration: false,
            hasMining: false,
            hasMedical: false,
            hasMultiCrew: false
        };

        for (const ship of ships) {
            // Count sizes
            if (ship.size) {
                sizeDistribution[ship.size] = (sizeDistribution[ship.size] || 0) + 1;
            }

            // Count roles
            const roles = ship.roles || (ship.role ? [ship.role] : []);
            for (const role of roles) {
                roleDistribution[role] = (roleDistribution[role] || 0) + 1;
                
                // Check capabilities
                const roleLower = role.toLowerCase();
                if (roleLower.includes('combat') || roleLower.includes('fighter') || roleLower.includes('military')) {
                    capabilities.hasCombat = true;
                }
                if (roleLower.includes('cargo') || roleLower.includes('freight') || roleLower.includes('transport')) {
                    capabilities.hasCargo = true;
                }
                if (roleLower.includes('exploration') || roleLower.includes('pathfinder')) {
                    capabilities.hasExploration = true;
                }
                if (roleLower.includes('mining')) {
                    capabilities.hasMining = true;
                }
                if (roleLower.includes('medical') || roleLower.includes('hospital')) {
                    capabilities.hasMedical = true;
                }
            }

            // Check multi-crew
            if (ship.maxCrew && ship.maxCrew >= 2) {
                capabilities.hasMultiCrew = true;
            }
        }

        // Identify gaps
        const gaps: string[] = [];
        if (!capabilities.hasCombat) {gaps.push('No combat-capable ships');}
        if (!capabilities.hasCargo) {gaps.push('No dedicated cargo ships');}
        if (!capabilities.hasExploration) {gaps.push('No exploration ships');}
        if (!capabilities.hasMining) {gaps.push('No mining ships');}
        if (!capabilities.hasMedical) {gaps.push('No medical support');}
        if (!capabilities.hasMultiCrew) {gaps.push('All ships are solo-only');}

        // Generate recommendations
        const recommendations: string[] = [];
        if (gaps.includes('No combat-capable ships')) {
            recommendations.push('Consider adding a fighter or combat ship for protection');
        }
        if (gaps.includes('No dedicated cargo ships')) {
            recommendations.push('A dedicated hauler would improve trading capabilities');
        }
        if (ships.length < 3) {
            recommendations.push('A diverse fleet of 3+ ships provides better versatility');
        }
        if (Object.keys(sizeDistribution).length === 1) {
            recommendations.push('Consider adding ships of different sizes for varied gameplay');
        }

        // Calculate overall score
        let overallScore = 50; // Base score
        const capabilityKeys = Object.keys(capabilities) as Array<keyof typeof capabilities>;
        overallScore += capabilityKeys.filter(k => capabilities[k]).length * 8;
        overallScore += Math.min(ships.length * 5, 20);
        overallScore = Math.min(overallScore, 100);

        return {
            ships,
            roleDistribution,
            sizeDistribution,
            capabilities,
            gaps,
            recommendations,
            overallScore
        };
    }

    /**
     * Get similar ships based on role and size
     */
    async getSimilarShips(shipId: string, limit: number = 5): Promise<Ship[]> {
        logger.info('ShipComparisonService.getSimilarShips', { shipId, limit });

        const ship = await this.shipRepository.findOne({ where: { id: shipId } });
        if (!ship) {
            throw new Error('Ship not found');
        }

        // Build query for similar ships
        const query = this.shipRepository.createQueryBuilder('ship')
            .where('ship.id != :shipId', { shipId })
            .andWhere('ship.isActive = :active', { active: true });

        // Get more results than needed to allow for sorting
        const ships = await query.take(limit * 3).getMany();

        // Sort results preferring same size and manufacturer
        const sorted = ships.sort((a, b) => {
            let scoreA = 0;
            let scoreB = 0;

            // Prefer same size (higher priority)
            if (ship.size) {
                if (a.size === ship.size) { scoreA += 2; }
                if (b.size === ship.size) { scoreB += 2; }
            }

            // Prefer same manufacturer (lower priority)
            if (ship.manufacturer) {
                if (a.manufacturer === ship.manufacturer) { scoreA += 1; }
                if (b.manufacturer === ship.manufacturer) { scoreB += 1; }
            }

            return scoreB - scoreA;
        });

        return sorted.slice(0, limit);
    }

    /**
     * Quick comparison of two ships
     */
    async quickCompare(shipId1: string, shipId2: string): Promise<{
        ship1: Ship;
        ship2: Ship;
        winner: string;
        breakdown: {
            category: string;
            ship1Score: number;
            ship2Score: number;
            winner: string;
        }[];
    }> {
        const result = await this.compareShips([shipId1, shipId2]);
        
        const ship1Data = result.ships.find(s => s.ship.id === shipId1);
        const ship2Data = result.ships.find(s => s.ship.id === shipId2);

        if (!ship1Data || !ship2Data) {
            throw new Error('Could not find ship data for comparison');
        }

        const scoreCategories: (keyof ShipComparisonData['scores'])[] = ['combat', 'cargo', 'speed', 'crew', 'value'];
        const breakdown = scoreCategories.map(category => ({
            category,
            ship1Score: ship1Data.scores[category],
            ship2Score: ship2Data.scores[category],
            winner: ship1Data.scores[category] > ship2Data.scores[category]
                ? ship1Data.ship.name
                : ship2Data.scores[category] > ship1Data.scores[category]
                    ? ship2Data.ship.name
                    : 'Tie'
        }));

        const winner = ship1Data.scores.overall > ship2Data.scores.overall
            ? ship1Data.ship.name
            : ship2Data.scores.overall > ship1Data.scores.overall
                ? ship2Data.ship.name
                : 'Tie';

        return {
            ship1: ship1Data.ship,
            ship2: ship2Data.ship,
            winner,
            breakdown
        };
    }
}

