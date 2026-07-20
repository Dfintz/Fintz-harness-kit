"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BriefingTemplateService = void 0;
const logger_1 = require("../../utils/logger");
const BRIEFING_TEMPLATES = [
    {
        id: 'combat-assault',
        name: 'Combat Assault Briefing',
        description: 'A comprehensive briefing template for combat assault operations including target designation, attack vectors, and support coordination',
        category: 'combat',
        icon: '⚔️',
        sections: [
            {
                name: 'Mission Objective',
                description: 'Primary and secondary objectives',
                required: true,
            },
            {
                name: 'Enemy Forces',
                description: 'Known enemy disposition and capabilities',
                required: true,
            },
            { name: 'Friendly Forces', description: 'Allied units and their roles', required: true },
            { name: 'Attack Plan', description: 'Phase-by-phase attack sequence', required: true },
            { name: 'Fire Support', description: 'Available fire support assets', required: false },
            {
                name: 'Contingencies',
                description: 'Fallback plans and emergency procedures',
                required: true,
            },
            { name: 'Communications', description: 'Comm channels and callsigns', required: true },
        ],
        elements: [
            {
                id: 'header-1',
                type: 'text',
                position: { x: 50, y: 20 },
                data: { content: 'COMBAT ASSAULT BRIEFING', color: '#ff4444', size: 24, font: 'bold' },
            },
            {
                id: 'objective-label',
                type: 'text',
                position: { x: 50, y: 60 },
                data: { content: 'MISSION OBJECTIVE:', color: '#ffffff', size: 16, font: 'bold' },
            },
            {
                id: 'objective-placeholder',
                type: 'text',
                position: { x: 50, y: 80 },
                data: { content: '[Enter primary objective here]', color: '#888888', size: 14 },
            },
            {
                id: 'target-marker',
                type: 'marker',
                position: { x: 400, y: 200 },
                data: { content: 'PRIMARY TARGET', color: '#ff0000', size: 20 },
            },
            {
                id: 'rally-marker',
                type: 'marker',
                position: { x: 200, y: 350 },
                data: { content: 'RALLY POINT', color: '#00ff00', size: 16 },
            },
        ],
        tags: ['combat', 'assault', 'tactical'],
        suggestedParticipantRoles: ['Squadron Leader', 'Wing Commander', 'Flight Lead', 'Support'],
        estimatedDuration: '30-60 minutes',
        difficulty: 'advanced',
    },
    {
        id: 'mining-operation',
        name: 'Mining Operation Briefing',
        description: 'Briefing template for coordinated mining operations including site designation, roles, and extraction plans',
        category: 'mining',
        icon: '⛏️',
        sections: [
            { name: 'Mining Site', description: 'Location and resource information', required: true },
            { name: 'Team Roles', description: 'Assigned roles for mining team', required: true },
            { name: 'Resources', description: 'Target resources and expected yields', required: true },
            { name: 'Equipment', description: 'Required ships and mining equipment', required: true },
            { name: 'Security', description: 'Security coverage and protocols', required: false },
            { name: 'Refinery', description: 'Refinery selection and logistics', required: true },
        ],
        elements: [
            {
                id: 'header-1',
                type: 'text',
                position: { x: 50, y: 20 },
                data: { content: 'MINING OPERATION BRIEFING', color: '#44aaff', size: 24, font: 'bold' },
            },
            {
                id: 'site-label',
                type: 'text',
                position: { x: 50, y: 60 },
                data: { content: 'MINING SITE:', color: '#ffffff', size: 16, font: 'bold' },
            },
            {
                id: 'site-placeholder',
                type: 'text',
                position: { x: 50, y: 80 },
                data: { content: '[Enter mining location here]', color: '#888888', size: 14 },
            },
            {
                id: 'mining-zone',
                type: 'shape',
                position: { x: 350, y: 180 },
                data: { shapeType: 'circle', color: '#44aaff', width: 100, height: 100 },
            },
            {
                id: 'mining-marker',
                type: 'marker',
                position: { x: 350, y: 180 },
                data: { content: 'MINING ZONE', color: '#44aaff', size: 16 },
            },
        ],
        tags: ['mining', 'extraction', 'resources'],
        suggestedParticipantRoles: ['Foreman', 'Prospector', 'Miner', 'Hauler', 'Security'],
        estimatedDuration: '15-30 minutes',
        difficulty: 'beginner',
    },
    {
        id: 'trade-convoy',
        name: 'Trade Convoy Briefing',
        description: 'Briefing template for trade convoy operations including route planning, cargo details, and escort coordination',
        category: 'trading',
        icon: '📦',
        sections: [
            { name: 'Route', description: 'Trade route and waypoints', required: true },
            { name: 'Cargo', description: 'Cargo manifest and values', required: true },
            { name: 'Schedule', description: 'Departure and arrival times', required: true },
            { name: 'Convoy Formation', description: 'Ship positions and formation', required: true },
            { name: 'Escort', description: 'Escort ship assignments', required: false },
            { name: 'Emergency', description: 'Emergency protocols', required: true },
        ],
        elements: [
            {
                id: 'header-1',
                type: 'text',
                position: { x: 50, y: 20 },
                data: { content: 'TRADE CONVOY BRIEFING', color: '#ffaa44', size: 24, font: 'bold' },
            },
            {
                id: 'route-label',
                type: 'text',
                position: { x: 50, y: 60 },
                data: { content: 'TRADE ROUTE:', color: '#ffffff', size: 16, font: 'bold' },
            },
            {
                id: 'origin-marker',
                type: 'marker',
                position: { x: 100, y: 200 },
                data: { content: 'ORIGIN', color: '#00ff00', size: 16 },
            },
            {
                id: 'destination-marker',
                type: 'marker',
                position: { x: 500, y: 200 },
                data: { content: 'DESTINATION', color: '#ff0000', size: 16 },
            },
            {
                id: 'route-line',
                type: 'arrow',
                position: { x: 100, y: 200 },
                data: { color: '#ffaa44', width: 400, rotation: 0 },
            },
        ],
        tags: ['trading', 'convoy', 'cargo', 'escort'],
        suggestedParticipantRoles: ['Convoy Lead', 'Merchant', 'Escort', 'Scout'],
        estimatedDuration: '15-20 minutes',
        difficulty: 'intermediate',
    },
    {
        id: 'exploration-expedition',
        name: 'Exploration Expedition Briefing',
        description: 'Briefing template for exploration expeditions including survey objectives and discovery protocols',
        category: 'exploration',
        icon: '🔭',
        sections: [
            { name: 'Exploration Zone', description: 'Target area and coordinates', required: true },
            { name: 'Objectives', description: 'Survey and discovery objectives', required: true },
            { name: 'Team Composition', description: 'Expedition team roles', required: true },
            { name: 'Equipment', description: 'Required scanning and survey equipment', required: true },
            { name: 'Data Collection', description: 'Data recording protocols', required: true },
            { name: 'Hazards', description: 'Known and potential hazards', required: false },
        ],
        elements: [
            {
                id: 'header-1',
                type: 'text',
                position: { x: 50, y: 20 },
                data: {
                    content: 'EXPLORATION EXPEDITION BRIEFING',
                    color: '#aa44ff',
                    size: 24,
                    font: 'bold',
                },
            },
            {
                id: 'zone-label',
                type: 'text',
                position: { x: 50, y: 60 },
                data: { content: 'EXPLORATION ZONE:', color: '#ffffff', size: 16, font: 'bold' },
            },
            {
                id: 'survey-area',
                type: 'shape',
                position: { x: 300, y: 200 },
                data: { shapeType: 'rectangle', color: '#aa44ff', width: 200, height: 150 },
            },
            {
                id: 'survey-marker',
                type: 'marker',
                position: { x: 300, y: 200 },
                data: { content: 'SURVEY ZONE', color: '#aa44ff', size: 16 },
            },
        ],
        tags: ['exploration', 'survey', 'discovery'],
        suggestedParticipantRoles: ['Expedition Lead', 'Navigator', 'Scientist', 'Security'],
        estimatedDuration: '20-30 minutes',
        difficulty: 'intermediate',
    },
    {
        id: 'search-rescue',
        name: 'Search & Rescue Briefing',
        description: 'Briefing template for search and rescue operations including search patterns and medical protocols',
        category: 'rescue',
        icon: '🚑',
        sections: [
            { name: 'Incident', description: 'Incident details and last known position', required: true },
            { name: 'Victims', description: 'Number and condition of victims', required: true },
            { name: 'Search Pattern', description: 'Search grid and pattern', required: true },
            { name: 'Medical', description: 'Medical requirements and triage', required: true },
            { name: 'Evacuation', description: 'Evacuation route and destination', required: true },
            { name: 'Hazards', description: 'Environmental and other hazards', required: true },
        ],
        elements: [
            {
                id: 'header-1',
                type: 'text',
                position: { x: 50, y: 20 },
                data: { content: 'SEARCH & RESCUE BRIEFING', color: '#44ff44', size: 24, font: 'bold' },
            },
            {
                id: 'incident-label',
                type: 'text',
                position: { x: 50, y: 60 },
                data: { content: 'INCIDENT LOCATION:', color: '#ffffff', size: 16, font: 'bold' },
            },
            {
                id: 'search-area',
                type: 'shape',
                position: { x: 300, y: 200 },
                data: { shapeType: 'circle', color: '#ffff00', width: 150, height: 150 },
            },
            {
                id: 'incident-marker',
                type: 'marker',
                position: { x: 300, y: 200 },
                data: { content: 'LAST KNOWN POS', color: '#ff0000', size: 16 },
            },
            {
                id: 'evac-marker',
                type: 'marker',
                position: { x: 500, y: 350 },
                data: { content: 'EVAC POINT', color: '#00ff00', size: 16 },
            },
        ],
        tags: ['rescue', 'search', 'medical', 'emergency'],
        suggestedParticipantRoles: ['SAR Commander', 'Medic', 'Rescue Pilot', 'Tow Operator'],
        estimatedDuration: '10-15 minutes',
        difficulty: 'advanced',
    },
    {
        id: 'reconnaissance-mission',
        name: 'Reconnaissance Mission Briefing',
        description: 'Briefing template for reconnaissance and intelligence gathering missions',
        category: 'reconnaissance',
        icon: '👁️',
        sections: [
            { name: 'Target Area', description: 'Reconnaissance target and coordinates', required: true },
            { name: 'Intel Objectives', description: 'Information to gather', required: true },
            { name: 'Approach', description: 'Ingress and egress routes', required: true },
            { name: 'Detection', description: 'Stealth and detection avoidance', required: true },
            { name: 'Reporting', description: 'Intelligence reporting procedures', required: true },
            { name: 'Abort Criteria', description: 'Conditions for mission abort', required: true },
        ],
        elements: [
            {
                id: 'header-1',
                type: 'text',
                position: { x: 50, y: 20 },
                data: { content: 'RECONNAISSANCE BRIEFING', color: '#888888', size: 24, font: 'bold' },
            },
            {
                id: 'target-label',
                type: 'text',
                position: { x: 50, y: 60 },
                data: { content: 'TARGET AREA:', color: '#ffffff', size: 16, font: 'bold' },
            },
            {
                id: 'observation-point',
                type: 'marker',
                position: { x: 200, y: 200 },
                data: { content: 'OBS POINT', color: '#888888', size: 14 },
            },
            {
                id: 'target-zone',
                type: 'shape',
                position: { x: 400, y: 200 },
                data: { shapeType: 'rectangle', color: '#ff4444', width: 100, height: 80 },
            },
            {
                id: 'approach-line',
                type: 'line',
                position: { x: 200, y: 200 },
                data: { color: '#888888', width: 200, rotation: 0 },
            },
        ],
        tags: ['reconnaissance', 'intel', 'stealth', 'surveillance'],
        suggestedParticipantRoles: ['Team Lead', 'Scout', 'Communications'],
        estimatedDuration: '15-25 minutes',
        difficulty: 'advanced',
    },
    {
        id: 'escort-mission',
        name: 'Escort Mission Briefing',
        description: 'Briefing template for escort and protection missions',
        category: 'escort',
        icon: '🛡️',
        sections: [
            { name: 'Principal', description: 'VIP or asset to be escorted', required: true },
            { name: 'Route', description: 'Escort route and waypoints', required: true },
            { name: 'Threat Assessment', description: 'Known and potential threats', required: true },
            { name: 'Formation', description: 'Escort formation and positions', required: true },
            { name: 'Response', description: 'Response protocols for attacks', required: true },
            { name: 'Contingencies', description: 'Backup routes and safe houses', required: true },
        ],
        elements: [
            {
                id: 'header-1',
                type: 'text',
                position: { x: 50, y: 20 },
                data: { content: 'ESCORT MISSION BRIEFING', color: '#4488ff', size: 24, font: 'bold' },
            },
            {
                id: 'principal-label',
                type: 'text',
                position: { x: 50, y: 60 },
                data: { content: 'PRINCIPAL:', color: '#ffffff', size: 16, font: 'bold' },
            },
            {
                id: 'principal-marker',
                type: 'marker',
                position: { x: 300, y: 200 },
                data: { content: 'VIP', color: '#ffff00', size: 20 },
            },
            {
                id: 'escort-1',
                type: 'marker',
                position: { x: 250, y: 180 },
                data: { content: 'E1', color: '#4488ff', size: 14 },
            },
            {
                id: 'escort-2',
                type: 'marker',
                position: { x: 350, y: 180 },
                data: { content: 'E2', color: '#4488ff', size: 14 },
            },
            {
                id: 'escort-3',
                type: 'marker',
                position: { x: 300, y: 250 },
                data: { content: 'E3', color: '#4488ff', size: 14 },
            },
        ],
        tags: ['escort', 'protection', 'vip', 'security'],
        suggestedParticipantRoles: ['Escort Lead', 'Point', 'Flanker', 'Rear Guard'],
        estimatedDuration: '15-20 minutes',
        difficulty: 'intermediate',
    },
    {
        id: 'general-purpose',
        name: 'General Purpose Briefing',
        description: 'A flexible briefing template for various mission types',
        category: 'general',
        icon: '📋',
        sections: [
            { name: 'Overview', description: 'Mission overview and objectives', required: true },
            { name: 'Participants', description: 'Team members and roles', required: true },
            { name: 'Plan', description: 'Execution plan', required: true },
            { name: 'Resources', description: 'Required resources and equipment', required: false },
            { name: 'Timeline', description: 'Mission timeline', required: false },
            { name: 'Notes', description: 'Additional notes', required: false },
        ],
        elements: [
            {
                id: 'header-1',
                type: 'text',
                position: { x: 50, y: 20 },
                data: { content: 'MISSION BRIEFING', color: '#ffffff', size: 24, font: 'bold' },
            },
            {
                id: 'overview-label',
                type: 'text',
                position: { x: 50, y: 60 },
                data: { content: 'MISSION OVERVIEW:', color: '#ffffff', size: 16, font: 'bold' },
            },
            {
                id: 'overview-placeholder',
                type: 'text',
                position: { x: 50, y: 80 },
                data: { content: '[Enter mission overview here]', color: '#888888', size: 14 },
            },
        ],
        tags: ['general', 'flexible', 'mission'],
        suggestedParticipantRoles: ['Leader', 'Member'],
        estimatedDuration: '10-20 minutes',
        difficulty: 'beginner',
    },
];
const customTemplates = new Map();
class BriefingTemplateService {
    static instance;
    constructor() {
        logger_1.logger.info('BriefingTemplateService initialized');
    }
    static getInstance() {
        if (!BriefingTemplateService.instance) {
            BriefingTemplateService.instance = new BriefingTemplateService();
        }
        return BriefingTemplateService.instance;
    }
    getTemplates() {
        return [...BRIEFING_TEMPLATES, ...Array.from(customTemplates.values())];
    }
    getBuiltInTemplates() {
        return [...BRIEFING_TEMPLATES];
    }
    validateOrganizationId(organizationId, operation) {
        if (!organizationId || organizationId.trim() === '') {
            throw new Error(`organizationId is required to ${operation}`);
        }
    }
    validateNotBuiltIn(templateId, operation) {
        if (BRIEFING_TEMPLATES.some(t => t.id === templateId)) {
            throw new Error(`Cannot ${operation} built-in templates`);
        }
    }
    getCustomTemplates(organizationId) {
        this.validateOrganizationId(organizationId, 'retrieve custom templates');
        const all = Array.from(customTemplates.values());
        return all.filter(t => t.organizationId === organizationId);
    }
    getTemplatesByCategory(category) {
        return this.getTemplates().filter(t => t.category === category);
    }
    getTemplatesByDifficulty(difficulty) {
        return this.getTemplates().filter(t => t.difficulty === difficulty);
    }
    getTemplate(templateId) {
        const builtIn = BRIEFING_TEMPLATES.find(t => t.id === templateId);
        if (builtIn) {
            return builtIn;
        }
        return customTemplates.get(templateId);
    }
    searchTemplates(query) {
        const lowerQuery = query.toLowerCase();
        return this.getTemplates().filter(t => t.name.toLowerCase().includes(lowerQuery) ||
            t.description.toLowerCase().includes(lowerQuery) ||
            t.tags.some(tag => tag.toLowerCase().includes(lowerQuery)));
    }
    createFromTemplate(options) {
        const template = this.getTemplate(options.templateId);
        if (!template) {
            throw new Error(`Template not found: ${options.templateId}`);
        }
        const elements = [...template.elements.map(e => ({ ...e })), ...(options.customElements || [])];
        const tags = [...template.tags, ...(options.customTags || [])];
        const briefingId = `briefing-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
        const now = new Date();
        const briefing = {
            id: briefingId,
            title: options.title,
            creatorId: options.creatorId,
            missionId: options.missionId,
            elements,
            status: 'draft',
            participants: options.participants || [],
            version: 1,
            tags,
            templateId: template.id,
            templateName: template.name,
            createdAt: now,
            updatedAt: now,
        };
        logger_1.logger.info('Briefing created from template', {
            briefingId: briefing.id,
            templateId: template.id,
            templateName: template.name,
            creatorId: options.creatorId,
        });
        return briefing;
    }
    createCustomTemplate(creatorId, template, organizationId) {
        this.validateOrganizationId(organizationId, 'create a custom briefing template');
        const templateId = `custom-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
        const customTemplate = {
            ...template,
            id: templateId,
            creatorId,
            organizationId,
        };
        customTemplates.set(templateId, customTemplate);
        logger_1.logger.info('Custom briefing template created', {
            templateId,
            templateName: template.name,
            creatorId,
            organizationId,
        });
        return customTemplate;
    }
    updateCustomTemplate(templateId, updates, organizationId) {
        const existing = customTemplates.get(templateId);
        if (!existing) {
            throw new Error(`Custom template not found: ${templateId}`);
        }
        this.validateNotBuiltIn(templateId, 'modify');
        this.validateOrganizationId(organizationId, 'update a custom template');
        if (!existing.organizationId || existing.organizationId !== organizationId) {
            throw new Error('Access denied: template belongs to a different organization');
        }
        const updated = {
            ...existing,
            ...updates,
            id: templateId,
        };
        customTemplates.set(templateId, updated);
        logger_1.logger.info('Custom briefing template updated', { templateId });
        return updated;
    }
    deleteCustomTemplate(templateId, organizationId) {
        this.validateNotBuiltIn(templateId, 'delete');
        this.validateOrganizationId(organizationId, 'delete a custom template');
        const existing = customTemplates.get(templateId);
        if (existing && (!existing.organizationId || existing.organizationId !== organizationId)) {
            throw new Error('Access denied: template belongs to a different organization');
        }
        const deleted = customTemplates.delete(templateId);
        if (deleted) {
            logger_1.logger.info('Custom briefing template deleted', { templateId, organizationId });
        }
        return deleted;
    }
    cloneTemplate(sourceTemplateId, creatorId, organizationId, newName) {
        const source = this.getTemplate(sourceTemplateId);
        if (!source) {
            throw new Error(`Source template not found: ${sourceTemplateId}`);
        }
        const cloned = this.createCustomTemplate(creatorId, {
            ...source,
            name: newName || `${source.name} (Copy)`,
        }, organizationId);
        logger_1.logger.info('Template cloned', {
            sourceTemplateId,
            newTemplateId: cloned.id,
            creatorId,
            organizationId,
        });
        return cloned;
    }
    recommendTemplates(needs) {
        let recommendations = [...this.getTemplates()];
        if (needs.missionType) {
            recommendations = recommendations.filter(t => t.category === needs.missionType || t.category === 'general');
        }
        if (needs.difficulty) {
            recommendations = recommendations.filter(t => t.difficulty === needs.difficulty);
        }
        if (needs.tags && needs.tags.length > 0) {
            const needsTags = needs.tags;
            recommendations = recommendations.sort((a, b) => {
                const aMatches = a.tags.filter(tag => needsTags.some(nt => tag.toLowerCase().includes(nt.toLowerCase()))).length;
                const bMatches = b.tags.filter(tag => needsTags.some(nt => tag.toLowerCase().includes(nt.toLowerCase()))).length;
                return bMatches - aMatches;
            });
        }
        return recommendations.slice(0, 5);
    }
    getCategories() {
        const categoryMap = new Map();
        for (const template of this.getTemplates()) {
            const existing = categoryMap.get(template.category);
            if (existing) {
                existing.count++;
            }
            else {
                categoryMap.set(template.category, { count: 1, icon: template.icon });
            }
        }
        return Array.from(categoryMap.entries()).map(([category, data]) => ({
            category,
            ...data,
        }));
    }
    getStats() {
        const templates = this.getTemplates();
        const categoryCounts = {
            combat: 0,
            mining: 0,
            trading: 0,
            exploration: 0,
            rescue: 0,
            reconnaissance: 0,
            escort: 0,
            general: 0,
        };
        const difficultyCounts = {
            beginner: 0,
            intermediate: 0,
            advanced: 0,
        };
        for (const template of templates) {
            categoryCounts[template.category]++;
            if (template.difficulty) {
                difficultyCounts[template.difficulty]++;
            }
        }
        return {
            totalTemplates: templates.length,
            builtInTemplates: BRIEFING_TEMPLATES.length,
            customTemplates: customTemplates.size,
            categoryCounts,
            difficultyCounts,
        };
    }
    clearCustomTemplates() {
        customTemplates.clear();
        logger_1.logger.info('All custom templates cleared');
    }
}
exports.BriefingTemplateService = BriefingTemplateService;
//# sourceMappingURL=BriefingTemplateService.js.map