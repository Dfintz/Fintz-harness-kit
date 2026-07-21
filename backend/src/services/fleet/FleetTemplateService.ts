import { AppDataSource } from '../../data-source';
import { Fleet, FleetStatus, FleetType } from '../../models/Fleet';
import { logAuditEvent, AuditEventType } from '../../utils/auditLogger';
import { logger } from '../../utils/logger';

import { FleetService } from './FleetService';

/**
 * Pre-configured fleet template
 * Issue #181: Add fleet templates - Pre-configured fleet setups
 */
export interface FleetTemplate {
  id: string;
  name: string;
  description: string;
  type: FleetType;
  settings: {
    maxCapacity?: number;
    minimumSecurityLevel?: number;
    isPrivate?: boolean;
    allowAutoJoin?: boolean;
  };
  defaultRoles?: string[];
  suggestedShipTypes?: string[];
  category: 'combat' | 'mining' | 'trading' | 'exploration' | 'rescue' | 'general';
  icon?: string;
}

// Pre-defined fleet templates
const FLEET_TEMPLATES: FleetTemplate[] = [
  {
    id: 'combat-squadron',
    name: 'Combat Squadron',
    description: 'A tactical combat unit for military operations and defense',
    type: FleetType.COMBAT,
    settings: {
      maxCapacity: 16,
      minimumSecurityLevel: 3,
      isPrivate: true,
      allowAutoJoin: false,
    },
    defaultRoles: ['Wing Commander', 'Flight Lead', 'Wingman', 'Support'],
    suggestedShipTypes: ['Fighter', 'Bomber', 'Heavy Fighter', 'Interceptor'],
    category: 'combat',
    icon: '⚔️',
  },
  {
    id: 'mining-operation',
    name: 'Mining Operation',
    description: 'An organized mining fleet for resource extraction',
    type: FleetType.MINING,
    settings: {
      maxCapacity: 12,
      minimumSecurityLevel: 1,
      isPrivate: false,
      allowAutoJoin: true,
    },
    defaultRoles: ['Foreman', 'Miner', 'Hauler', 'Security'],
    suggestedShipTypes: ['Mining Ship', 'Cargo Hauler', 'Refinery Ship', 'Escort'],
    category: 'mining',
    icon: '⛏️',
  },
  {
    id: 'trade-convoy',
    name: 'Trade Convoy',
    description: 'A merchant fleet for coordinated trading runs',
    type: FleetType.TRADING,
    settings: {
      maxCapacity: 8,
      minimumSecurityLevel: 2,
      isPrivate: false,
      allowAutoJoin: true,
    },
    defaultRoles: ['Convoy Lead', 'Merchant', 'Escort', 'Scout'],
    suggestedShipTypes: ['Cargo Ship', 'Freighter', 'Fighter Escort', 'Pathfinder'],
    category: 'trading',
    icon: '📦',
  },
  {
    id: 'exploration-team',
    name: 'Exploration Team',
    description: 'A dedicated exploration unit for discovering new frontiers',
    type: FleetType.EXPLORATION,
    settings: {
      maxCapacity: 6,
      minimumSecurityLevel: 2,
      isPrivate: true,
      allowAutoJoin: false,
    },
    defaultRoles: ['Expedition Lead', 'Navigator', 'Scientist', 'Security'],
    suggestedShipTypes: ['Explorer', 'Science Vessel', 'Pathfinder', 'Support Ship'],
    category: 'exploration',
    icon: '🔭',
  },
  {
    id: 'search-rescue',
    name: 'Search & Rescue',
    description: 'A rapid response unit for emergency rescue operations',
    type: FleetType.MEDICAL,
    settings: {
      maxCapacity: 10,
      minimumSecurityLevel: 2,
      isPrivate: false,
      allowAutoJoin: true,
    },
    defaultRoles: ['SAR Commander', 'Medic', 'Rescue Pilot', 'Tow Operator'],
    suggestedShipTypes: ['Medical Ship', 'Rescue Craft', 'Tug', 'Support'],
    category: 'rescue',
    icon: '🚑',
  },
  {
    id: 'general-purpose',
    name: 'General Purpose Fleet',
    description: 'A flexible fleet for various activities',
    type: FleetType.MIXED,
    settings: {
      maxCapacity: 20,
      minimumSecurityLevel: 1,
      isPrivate: false,
      allowAutoJoin: true,
    },
    defaultRoles: ['Fleet Commander', 'Officer', 'Member'],
    suggestedShipTypes: [],
    category: 'general',
    icon: '🚀',
  },
  {
    id: 'capital-ship-ops',
    name: 'Capital Ship Operations',
    description: 'Fleet organized around a capital ship',
    type: FleetType.COMBAT,
    settings: {
      maxCapacity: 50,
      minimumSecurityLevel: 4,
      isPrivate: true,
      allowAutoJoin: false,
    },
    defaultRoles: ['Admiral', 'Captain', 'Bridge Officer', 'Crew Chief', 'Deck Hand'],
    suggestedShipTypes: ['Capital Ship', 'Carrier', 'Support Ship', 'Fighter', 'Bomber'],
    category: 'combat',
    icon: '🛸',
  },
  {
    id: 'stealth-ops',
    name: 'Stealth Operations',
    description: 'Covert operations unit for sensitive missions',
    type: FleetType.RECONNAISSANCE,
    settings: {
      maxCapacity: 4,
      minimumSecurityLevel: 5,
      isPrivate: true,
      allowAutoJoin: false,
    },
    defaultRoles: ['Team Lead', 'Operative'],
    suggestedShipTypes: ['Stealth Ship', 'Infiltrator', 'Scout'],
    category: 'combat',
    icon: '👁️',
  },
];

/**
 * Fleet Template Service
 * Provides pre-configured fleet templates for easy fleet creation
 */
export class FleetTemplateService {
  private static instance: FleetTemplateService;
  private fleetRepository = AppDataSource.getRepository(Fleet);
  private fleetService: FleetService;

  private constructor() {
    this.fleetService = new FleetService();
  }

  public static getInstance(): FleetTemplateService {
    if (!FleetTemplateService.instance) {
      FleetTemplateService.instance = new FleetTemplateService();
    }
    return FleetTemplateService.instance;
  }

  /**
   * Get all available fleet templates
   */
  public getTemplates(): FleetTemplate[] {
    return FLEET_TEMPLATES;
  }

  /**
   * Get templates by category
   */
  public getTemplatesByCategory(category: FleetTemplate['category']): FleetTemplate[] {
    return FLEET_TEMPLATES.filter((t) => t.category === category);
  }

  /**
   * Get a specific template by ID
   */
  public getTemplate(templateId: string): FleetTemplate | undefined {
    return FLEET_TEMPLATES.find((t) => t.id === templateId);
  }

  /**
   * Create a fleet from a template
   */
  public async createFleetFromTemplate(
    templateId: string,
    organizationId: string,
    createdBy: string,
    overrides?: {
      name?: string;
      description?: string;
      settings?: Partial<FleetTemplate['settings']>;
    }
  ): Promise<Fleet> {
    const template = this.getTemplate(templateId);

    if (!template) {
      throw new Error(`Template not found: ${templateId}`);
    }

    const fleetName = overrides?.name || template.name;
    const fleetDescription = overrides?.description || template.description;
    const settings = { ...template.settings, ...overrides?.settings };

    // Generate a unique ID for the fleet
    const fleetId = `fleet-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    // Create the fleet using FleetService
    const fleet = await this.fleetService.createFleet(organizationId, {
      id: fleetId,
      name: fleetName,
      description: fleetDescription,
      type: template.type,
      status: FleetStatus.ACTIVE,
      maxMembers: settings.maxCapacity || 50,
      isPublic: !settings.isPrivate,
      allowApplications: settings.allowAutoJoin || false,
      members: [],
      tags: template.defaultRoles || [],
    });

    // Log template usage
    logAuditEvent({
      eventType: AuditEventType.SENSITIVE_DATA_ACCESS,
      userId: createdBy,
      message: `Fleet created from template: ${template.name}`,
      metadata: {
        fleetId: fleet.id,
        templateId,
        organizationId,
      },
    });

    logger.info('Fleet created from template', {
      fleetId: fleet.id,
      templateId,
      templateName: template.name,
      organizationId,
      createdBy,
    });

    return fleet;
  }

  /**
   * Get template recommendations based on organization needs
   */
  public recommendTemplates(
    needs: {
      primaryActivity?: 'combat' | 'mining' | 'trading' | 'exploration' | 'general';
      expectedSize?: 'small' | 'medium' | 'large';
      securityLevel?: 'low' | 'medium' | 'high';
    }
  ): FleetTemplate[] {
    let recommendations = [...FLEET_TEMPLATES];

    // Filter by primary activity
    if (needs.primaryActivity) {
      recommendations = recommendations.filter(
        (t) => t.category === needs.primaryActivity || t.category === 'general'
      );
    }

    // Sort by size match
    if (needs.expectedSize) {
      const sizeRanges = {
        small: [1, 8],
        medium: [8, 20],
        large: [20, 100],
      };
      const [min, max] = sizeRanges[needs.expectedSize];

      recommendations = recommendations.sort((a, b) => {
        const aCapacity = a.settings.maxCapacity || 10;
        const bCapacity = b.settings.maxCapacity || 10;
        const aInRange = aCapacity >= min && aCapacity <= max;
        const bInRange = bCapacity >= min && bCapacity <= max;

        if (aInRange && !bInRange) {return -1;}
        if (!aInRange && bInRange) {return 1;}
        return 0;
      });
    }

    // Sort by security level match
    if (needs.securityLevel) {
      const securityLevels = { low: 1, medium: 3, high: 5 };
      const targetLevel = securityLevels[needs.securityLevel];

      recommendations = recommendations.sort((a, b) => {
        const aDiff = Math.abs((a.settings.minimumSecurityLevel || 1) - targetLevel);
        const bDiff = Math.abs((b.settings.minimumSecurityLevel || 1) - targetLevel);
        return aDiff - bDiff;
      });
    }

    return recommendations.slice(0, 5); // Return top 5 recommendations
  }
}

