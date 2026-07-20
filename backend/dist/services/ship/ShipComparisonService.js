"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ShipComparisonService = void 0;
const data_source_1 = require("../../data-source");
const Ship_1 = require("../../models/Ship");
const logger_1 = require("../../utils/logger");
const DEFAULT_VALUE_SCORE = 50;
const DEFAULT_CREW_SCORE = 50;
const CARGO_VALUE_WEIGHT = 0.1;
const SPEED_VALUE_WEIGHT = 0.01;
const SHIELDS_VALUE_WEIGHT = 0.1;
class ShipComparisonService {
    shipRepository = data_source_1.AppDataSource.getRepository(Ship_1.Ship);
    async compareShips(shipIds) {
        logger_1.logger.info('ShipComparisonService.compareShips', { shipCount: shipIds.length });
        if (shipIds.length < 2) {
            throw new Error('At least 2 ships are required for comparison');
        }
        const ships = await this.shipRepository
            .createQueryBuilder('ship')
            .where('ship.id IN (:...ids)', { ids: shipIds })
            .getMany();
        if (ships.length < 2) {
            throw new Error('Could not find enough ships for comparison');
        }
        const shipData = ships.map(ship => ({
            ship,
            scores: this.calculateShipScores(ship),
            rankings: {}
        }));
        this.calculateRankings(shipData);
        const categories = this.buildComparisonCategories(ships);
        const summary = this.buildComparisonSummary(shipData);
        return {
            ships: shipData,
            categories,
            summary
        };
    }
    calculateShipScores(ship) {
        const combat = this.calculateCombatScore(ship);
        const cargo = this.calculateCargoScore(ship);
        const speed = this.calculateSpeedScore(ship);
        const crew = this.calculateCrewScore(ship);
        const value = this.calculateValueScore(ship);
        const overall = (combat + cargo + speed + crew + value) / 5;
        return { combat, cargo, speed, crew, value, overall };
    }
    calculateCombatScore(ship) {
        let score = 0;
        if (ship.weapons && ship.weapons.length > 0) {
            const weaponScore = ship.weapons.reduce((acc, w) => acc + (w.size * w.count * 10), 0);
            score += Math.min(weaponScore, 40);
        }
        if (ship.shields) {
            score += Math.min(ship.shields / 10, 30);
        }
        if (ship.size) {
            const sizeScores = {
                [Ship_1.ShipSize.VEHICLE]: 5,
                [Ship_1.ShipSize.SNUB]: 10,
                [Ship_1.ShipSize.SMALL]: 15,
                [Ship_1.ShipSize.MEDIUM]: 20,
                [Ship_1.ShipSize.LARGE]: 25,
                [Ship_1.ShipSize.CAPITAL]: 30
            };
            score += sizeScores[ship.size] || 10;
        }
        return Math.min(Math.round(score), 100);
    }
    calculateCargoScore(ship) {
        let score = 0;
        if (ship.cargo) {
            score = Math.min((ship.cargo / 10000) * 100, 100);
        }
        if (ship.vehicleCargo) {
            score += Math.min((ship.vehicleCargo / 100) * 10, 10);
        }
        return Math.round(score);
    }
    calculateSpeedScore(ship) {
        let score = 0;
        if (ship.speed) {
            score += (ship.speed / 1400) * 40;
        }
        if (ship.afterburnerSpeed) {
            score += (ship.afterburnerSpeed / 1400) * 30;
        }
        if (ship.quantumSpeed) {
            score += (ship.quantumSpeed / 300000) * 30;
        }
        return Math.round(Math.min(score, 100));
    }
    calculateCrewScore(ship) {
        let score = DEFAULT_CREW_SCORE;
        if (ship.minCrew && ship.maxCrew) {
            const flexibility = ship.maxCrew > 0 ? (1 - (ship.minCrew / ship.maxCrew)) * 30 : 0;
            score += flexibility;
        }
        if (ship.minCrew === 1) {
            score += 20;
        }
        return Math.round(Math.min(score, 100));
    }
    calculateValueScore(ship) {
        if (!ship.price) {
            return DEFAULT_VALUE_SCORE;
        }
        const price = Number(ship.price);
        let capability = 0;
        if (ship.cargo) {
            capability += ship.cargo * CARGO_VALUE_WEIGHT;
        }
        if (ship.speed) {
            capability += ship.speed * SPEED_VALUE_WEIGHT;
        }
        if (ship.shields) {
            capability += ship.shields * SHIELDS_VALUE_WEIGHT;
        }
        const valueRatio = capability / (price / 10000);
        return Math.round(Math.min(valueRatio * 10, 100));
    }
    calculateRankings(shipData) {
        const categories = ['combat', 'cargo', 'speed', 'crew', 'value', 'overall'];
        for (const category of categories) {
            const sorted = [...shipData].sort((a, b) => b.scores[category] - a.scores[category]);
            sorted.forEach((data, index) => {
                data.rankings[category] = index + 1;
            });
        }
    }
    buildComparisonCategories(ships) {
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
    buildMetric(name, unit, ships, property, higherIsBetter) {
        const values = ships.map(ship => ({
            shipId: ship.id,
            value: ship[property],
            isWinner: false
        }));
        const numericValues = values.filter(v => typeof v.value === 'number');
        if (numericValues.length > 0) {
            const sorted = [...numericValues].sort((a, b) => {
                const aVal = a.value;
                const bVal = b.value;
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
    buildComparisonSummary(shipData) {
        const summary = {
            totalShips: shipData.length,
            recommendations: []
        };
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
    async analyzeShipRoles(shipId) {
        logger_1.logger.info('ShipComparisonService.analyzeShipRoles', { shipId });
        const ship = await this.shipRepository.findOne({ where: { id: shipId } });
        if (!ship) {
            throw new Error('Ship not found');
        }
        const capabilities = [];
        const bestFor = [];
        const limitations = [];
        const combatScore = this.calculateCombatScore(ship);
        capabilities.push({
            role: 'Combat',
            score: combatScore,
            description: combatScore >= 70 ? 'Excellent combat capability' :
                combatScore >= 40 ? 'Moderate combat capability' :
                    'Limited combat capability'
        });
        if (combatScore >= 70) {
            bestFor.push('Combat missions');
        }
        if (combatScore < 30) {
            limitations.push('Not suited for heavy combat');
        }
        const cargoScore = this.calculateCargoScore(ship);
        capabilities.push({
            role: 'Cargo',
            score: cargoScore,
            description: cargoScore >= 70 ? 'Excellent cargo capacity' :
                cargoScore >= 40 ? 'Moderate cargo capacity' :
                    'Limited cargo capacity'
        });
        if (cargoScore >= 70) {
            bestFor.push('Trading and hauling');
        }
        if (cargoScore < 20) {
            limitations.push('Minimal cargo space');
        }
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
        if (explorationScore >= 70) {
            bestFor.push('Exploration');
        }
        const crewCapacity = ship.maxCrew || 1;
        const multiCrewScore = Math.min((crewCapacity / 10) * 100, 100);
        capabilities.push({
            role: 'Multi-Crew',
            score: multiCrewScore,
            description: crewCapacity >= 5 ? 'Full multi-crew experience' :
                crewCapacity >= 2 ? 'Some multi-crew capability' :
                    'Solo ship'
        });
        if (crewCapacity >= 5) {
            bestFor.push('Group gameplay');
        }
        if (crewCapacity === 1) {
            limitations.push('Solo only');
        }
        const primaryRoles = [];
        if (ship.role) {
            primaryRoles.push(ship.role);
        }
        if (ship.roles) {
            primaryRoles.push(...ship.roles);
        }
        return {
            shipId: ship.id,
            shipName: ship.name,
            primaryRoles,
            capabilities,
            bestFor,
            limitations
        };
    }
    async analyzeFleetComposition(shipIds) {
        logger_1.logger.info('ShipComparisonService.analyzeFleetComposition', { shipCount: shipIds.length });
        const ships = await this.shipRepository
            .createQueryBuilder('ship')
            .where('ship.id IN (:...ids)', { ids: shipIds })
            .getMany();
        const roleDistribution = {};
        const sizeDistribution = {};
        const capabilities = {
            hasCombat: false,
            hasCargo: false,
            hasExploration: false,
            hasMining: false,
            hasMedical: false,
            hasMultiCrew: false
        };
        for (const ship of ships) {
            if (ship.size) {
                sizeDistribution[ship.size] = (sizeDistribution[ship.size] || 0) + 1;
            }
            const roles = ship.roles || (ship.role ? [ship.role] : []);
            for (const role of roles) {
                roleDistribution[role] = (roleDistribution[role] || 0) + 1;
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
            if (ship.maxCrew && ship.maxCrew >= 2) {
                capabilities.hasMultiCrew = true;
            }
        }
        const gaps = [];
        if (!capabilities.hasCombat) {
            gaps.push('No combat-capable ships');
        }
        if (!capabilities.hasCargo) {
            gaps.push('No dedicated cargo ships');
        }
        if (!capabilities.hasExploration) {
            gaps.push('No exploration ships');
        }
        if (!capabilities.hasMining) {
            gaps.push('No mining ships');
        }
        if (!capabilities.hasMedical) {
            gaps.push('No medical support');
        }
        if (!capabilities.hasMultiCrew) {
            gaps.push('All ships are solo-only');
        }
        const recommendations = [];
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
        let overallScore = 50;
        const capabilityKeys = Object.keys(capabilities);
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
    async getSimilarShips(shipId, limit = 5) {
        logger_1.logger.info('ShipComparisonService.getSimilarShips', { shipId, limit });
        const ship = await this.shipRepository.findOne({ where: { id: shipId } });
        if (!ship) {
            throw new Error('Ship not found');
        }
        const query = this.shipRepository.createQueryBuilder('ship')
            .where('ship.id != :shipId', { shipId })
            .andWhere('ship.isActive = :active', { active: true });
        const ships = await query.take(limit * 3).getMany();
        const sorted = ships.sort((a, b) => {
            let scoreA = 0;
            let scoreB = 0;
            if (ship.size) {
                if (a.size === ship.size) {
                    scoreA += 2;
                }
                if (b.size === ship.size) {
                    scoreB += 2;
                }
            }
            if (ship.manufacturer) {
                if (a.manufacturer === ship.manufacturer) {
                    scoreA += 1;
                }
                if (b.manufacturer === ship.manufacturer) {
                    scoreB += 1;
                }
            }
            return scoreB - scoreA;
        });
        return sorted.slice(0, limit);
    }
    async quickCompare(shipId1, shipId2) {
        const result = await this.compareShips([shipId1, shipId2]);
        const ship1Data = result.ships.find(s => s.ship.id === shipId1);
        const ship2Data = result.ships.find(s => s.ship.id === shipId2);
        if (!ship1Data || !ship2Data) {
            throw new Error('Could not find ship data for comparison');
        }
        const scoreCategories = ['combat', 'cargo', 'speed', 'crew', 'value'];
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
exports.ShipComparisonService = ShipComparisonService;
//# sourceMappingURL=ShipComparisonService.js.map