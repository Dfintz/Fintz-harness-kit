"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TicketRoutingService = void 0;
const node_crypto_1 = __importDefault(require("node:crypto"));
const Ticket_1 = require("../../../models/Ticket");
const logger_1 = require("../../../utils/logger");
const redis_1 = require("../../../utils/redis");
const routingRules = new Map();
const loadedOrganizations = new Set();
const ROUTING_RULES_TTL_SECONDS = 60 * 60 * 24 * 30;
const DEFAULT_RULES = [
    {
        name: 'Urgent Priority Escalation',
        description: 'Automatically escalate urgent priority tickets',
        isActive: true,
        priority: 1,
        conditions: [{ field: 'priority', operator: 'equals', value: Ticket_1.TicketPriority.URGENT }],
        conditionLogic: 'AND',
        actions: [
            { type: 'escalate', value: 'leadership' },
            { type: 'send_notification', value: 'leadership', metadata: { urgency: 'high' } },
        ],
    },
    {
        name: 'Recruitment Auto-Assignment',
        description: 'Route recruitment tickets to recruitment officers',
        isActive: true,
        priority: 10,
        conditions: [{ field: 'category', operator: 'equals', value: Ticket_1.TicketCategory.RECRUITMENT }],
        conditionLogic: 'AND',
        actions: [{ type: 'assign_to_role', value: 'Recruitment Officer' }],
    },
    {
        name: 'Diplomacy Auto-Assignment',
        description: 'Route diplomacy tickets to diplomats',
        isActive: true,
        priority: 10,
        conditions: [{ field: 'category', operator: 'equals', value: Ticket_1.TicketCategory.DIPLOMACY }],
        conditionLogic: 'AND',
        actions: [
            { type: 'assign_to_role', value: 'Diplomat' },
            { type: 'set_priority', value: Ticket_1.TicketPriority.HIGH },
        ],
    },
    {
        name: 'HR Confidential Handling',
        description: 'Route HR tickets with special handling',
        isActive: true,
        priority: 5,
        conditions: [{ field: 'category', operator: 'equals', value: Ticket_1.TicketCategory.HR }],
        conditionLogic: 'AND',
        actions: [
            { type: 'assign_to_role', value: 'HR Manager' },
            { type: 'add_tags', value: ['confidential'] },
        ],
    },
    {
        name: 'Harassment Keyword Detection',
        description: 'Escalate tickets containing harassment-related keywords',
        isActive: true,
        priority: 1,
        conditions: [
            { field: 'subject', operator: 'contains', value: 'harassment' },
            { field: 'description', operator: 'contains', value: 'harassment' },
        ],
        conditionLogic: 'OR',
        actions: [
            { type: 'escalate', value: 'leadership' },
            { type: 'set_priority', value: Ticket_1.TicketPriority.URGENT },
            { type: 'add_tags', value: ['harassment', 'urgent-review'] },
            { type: 'send_notification', value: 'hr-manager', metadata: { type: 'urgent' } },
        ],
    },
];
class TicketRoutingService {
    static instance;
    constructor() {
        logger_1.logger.info('TicketRoutingService initialized');
    }
    static getInstance() {
        if (!TicketRoutingService.instance) {
            TicketRoutingService.instance = new TicketRoutingService();
        }
        return TicketRoutingService.instance;
    }
    getCacheKey(organizationId) {
        return `tickets:routing-rules:${organizationId}`;
    }
    normalizeRule(rule) {
        return {
            ...rule,
            createdAt: new Date(rule.createdAt),
            updatedAt: new Date(rule.updatedAt),
            lastMatchedAt: rule.lastMatchedAt ? new Date(rule.lastMatchedAt) : undefined,
        };
    }
    async loadOrganizationRules(organizationId) {
        if (loadedOrganizations.has(organizationId)) {
            return;
        }
        const cachedRules = await redis_1.cache.get(this.getCacheKey(organizationId));
        if (cachedRules && Array.isArray(cachedRules)) {
            for (const rawRule of cachedRules) {
                const rule = this.normalizeRule(rawRule);
                routingRules.set(rule.id, rule);
            }
            logger_1.logger.info('Loaded routing rules from cache', {
                organizationId,
                count: cachedRules.length,
            });
        }
        loadedOrganizations.add(organizationId);
    }
    async persistOrganizationRules(organizationId) {
        const orgRules = Array.from(routingRules.values()).filter(r => r.organizationId === organizationId);
        const persisted = await redis_1.cache.set(this.getCacheKey(organizationId), orgRules, ROUTING_RULES_TTL_SECONDS);
        if (!persisted) {
            logger_1.logger.warn('Failed to persist routing rules to cache', {
                organizationId,
                count: orgRules.length,
            });
        }
    }
    createRule(dto) {
        const ruleId = `rule-${dto.organizationId}-${node_crypto_1.default.randomUUID()}`;
        const now = new Date();
        const rule = {
            id: ruleId,
            name: dto.name,
            description: dto.description,
            organizationId: dto.organizationId,
            isActive: true,
            priority: dto.priority || 100,
            conditions: dto.conditions,
            conditionLogic: dto.conditionLogic || 'AND',
            actions: dto.actions,
            createdAt: now,
            updatedAt: now,
            createdBy: dto.createdBy,
            matchCount: 0,
        };
        routingRules.set(ruleId, rule);
        logger_1.logger.info('Routing rule created', {
            ruleId,
            ruleName: dto.name,
            organizationId: dto.organizationId,
        });
        return rule;
    }
    async createRuleAsync(dto) {
        await this.loadOrganizationRules(dto.organizationId);
        const rule = this.createRule(dto);
        await this.persistOrganizationRules(dto.organizationId);
        return rule;
    }
    updateRule(ruleId, dto) {
        const existing = routingRules.get(ruleId);
        if (!existing) {
            throw new Error(`Routing rule not found: ${ruleId}`);
        }
        const updated = {
            ...existing,
            ...dto,
            id: ruleId,
            updatedAt: new Date(),
        };
        routingRules.set(ruleId, updated);
        logger_1.logger.info('Routing rule updated', { ruleId });
        return updated;
    }
    async updateRuleAsync(organizationId, ruleId, dto) {
        await this.loadOrganizationRules(organizationId);
        const existing = routingRules.get(ruleId);
        if (existing?.organizationId !== organizationId) {
            throw new Error(`Routing rule not found: ${ruleId}`);
        }
        const updated = this.updateRule(ruleId, dto);
        await this.persistOrganizationRules(organizationId);
        return updated;
    }
    deleteRule(ruleId) {
        const deleted = routingRules.delete(ruleId);
        if (deleted) {
            logger_1.logger.info('Routing rule deleted', { ruleId });
        }
        return deleted;
    }
    async deleteRuleAsync(organizationId, ruleId) {
        await this.loadOrganizationRules(organizationId);
        const existing = routingRules.get(ruleId);
        if (existing?.organizationId !== organizationId) {
            return false;
        }
        const deleted = this.deleteRule(ruleId);
        if (deleted) {
            await this.persistOrganizationRules(organizationId);
        }
        return deleted;
    }
    getRule(ruleId) {
        return routingRules.get(ruleId);
    }
    async getRuleAsync(organizationId, ruleId) {
        await this.loadOrganizationRules(organizationId);
        const rule = this.getRule(ruleId);
        if (rule?.organizationId !== organizationId) {
            return undefined;
        }
        return rule;
    }
    getRulesForOrganization(organizationId) {
        const orgRules = Array.from(routingRules.values()).filter(r => r.organizationId === organizationId);
        const defaultRulesWithIds = DEFAULT_RULES.map((rule, index) => ({
            ...rule,
            id: `default-${index}`,
            organizationId: 'system',
            createdAt: new Date('2025-01-01'),
            updatedAt: new Date('2025-01-01'),
            createdBy: 'system',
            matchCount: 0,
        }));
        return [...defaultRulesWithIds, ...orgRules]
            .filter(r => r.isActive)
            .sort((a, b) => a.priority - b.priority);
    }
    getRulesForOrganizationAdmin(organizationId) {
        const orgRules = Array.from(routingRules.values())
            .filter(r => r.organizationId === organizationId)
            .sort((a, b) => a.priority - b.priority);
        const defaultRulesWithIds = DEFAULT_RULES.map((rule, index) => ({
            ...rule,
            id: `default-${index}`,
            organizationId: 'system',
            createdAt: new Date('2025-01-01'),
            updatedAt: new Date('2025-01-01'),
            createdBy: 'system',
            matchCount: 0,
        }));
        return [...defaultRulesWithIds, ...orgRules];
    }
    async getRulesForOrganizationAsync(organizationId) {
        await this.loadOrganizationRules(organizationId);
        return this.getRulesForOrganization(organizationId);
    }
    async getRulesForOrganizationAdminAsync(organizationId) {
        await this.loadOrganizationRules(organizationId);
        return this.getRulesForOrganizationAdmin(organizationId);
    }
    evaluateTicket(organizationId, ticket) {
        const rules = this.getRulesForOrganization(organizationId);
        const result = {
            matched: false,
            matchedRules: [],
            actions: [],
            additionalTags: [],
            notifications: [],
            shouldEscalate: false,
        };
        for (const rule of rules) {
            if (this.evaluateRule(rule, ticket)) {
                result.matched = true;
                result.matchedRules.push(rule);
                result.actions.push(...rule.actions);
                const stored = routingRules.get(rule.id);
                if (stored) {
                    stored.matchCount++;
                    stored.lastMatchedAt = new Date();
                }
                for (const action of rule.actions) {
                    this.processAction(action, result);
                }
            }
        }
        logger_1.logger.info('Ticket routing evaluated', {
            organizationId,
            matched: result.matched,
            matchedRulesCount: result.matchedRules.length,
            actionsCount: result.actions.length,
        });
        return result;
    }
    async evaluateTicketAsync(organizationId, ticket) {
        await this.loadOrganizationRules(organizationId);
        const result = this.evaluateTicket(organizationId, ticket);
        if (result.matchedRules.some(rule => !rule.id.startsWith('default-'))) {
            await this.persistOrganizationRules(organizationId);
        }
        return result;
    }
    evaluateRule(rule, ticket) {
        const conditionResults = rule.conditions.map(condition => this.evaluateCondition(condition, ticket));
        if (rule.conditionLogic === 'AND') {
            return conditionResults.every(Boolean);
        }
        else {
            return conditionResults.some(Boolean);
        }
    }
    evaluateCondition(condition, ticket) {
        const ticketValue = this.getTicketFieldValue(ticket, condition.field);
        switch (condition.operator) {
            case 'equals':
                return ticketValue === condition.value;
            case 'not_equals':
                return ticketValue !== condition.value;
            case 'contains':
                return this.evaluateContains(ticketValue, condition.value);
            case 'not_contains':
                return this.evaluateNotContains(ticketValue, condition.value);
            case 'starts_with':
                return this.evaluateStringBoundary(ticketValue, condition.value, 'starts_with');
            case 'ends_with':
                return this.evaluateStringBoundary(ticketValue, condition.value, 'ends_with');
            case 'in_list':
                return this.evaluateListMembership(ticketValue, condition.value, true);
            case 'not_in_list':
                return this.evaluateListMembership(ticketValue, condition.value, false);
            case 'matches_regex':
                return this.evaluateRegex(ticketValue, condition.value);
            default:
                return false;
        }
    }
    evaluateContains(ticketValue, conditionValue) {
        if (typeof conditionValue !== 'string') {
            return false;
        }
        const searchValue = conditionValue.toLowerCase();
        if (typeof ticketValue === 'string') {
            return ticketValue.toLowerCase().includes(searchValue);
        }
        if (Array.isArray(ticketValue)) {
            return ticketValue.some(value => value.toLowerCase().includes(searchValue));
        }
        return false;
    }
    evaluateNotContains(ticketValue, conditionValue) {
        if (typeof conditionValue !== 'string') {
            return true;
        }
        if (typeof ticketValue === 'string') {
            return !ticketValue.toLowerCase().includes(conditionValue.toLowerCase());
        }
        if (Array.isArray(ticketValue)) {
            const searchValue = conditionValue.toLowerCase();
            return !ticketValue.some(value => value.toLowerCase().includes(searchValue));
        }
        return true;
    }
    evaluateStringBoundary(ticketValue, conditionValue, operator) {
        if (typeof ticketValue !== 'string' || typeof conditionValue !== 'string') {
            return false;
        }
        const source = ticketValue.toLowerCase();
        const needle = conditionValue.toLowerCase();
        return operator === 'starts_with' ? source.startsWith(needle) : source.endsWith(needle);
    }
    evaluateListMembership(ticketValue, conditionValue, include) {
        if (!Array.isArray(conditionValue)) {
            return !include;
        }
        const inList = Array.isArray(ticketValue)
            ? ticketValue.some(value => conditionValue.includes(value))
            : typeof ticketValue === 'string'
                ? conditionValue.includes(ticketValue)
                : false;
        return include ? inList : !inList;
    }
    evaluateRegex(ticketValue, conditionValue) {
        if (typeof ticketValue !== 'string' || typeof conditionValue !== 'string') {
            return false;
        }
        try {
            const regex = new RegExp(conditionValue, 'i');
            return regex.test(ticketValue);
        }
        catch {
            return false;
        }
    }
    getTicketFieldValue(ticket, field) {
        switch (field) {
            case 'category':
                return ticket.category;
            case 'priority':
                return ticket.priority;
            case 'subject':
                return ticket.subject;
            case 'description':
                return ticket.description;
            case 'tags':
                return ticket.tags;
            case 'creatorDiscordId':
                return ticket.creatorDiscordId;
            case 'creatorEmail':
                return ticket.creatorEmail;
            default:
                return undefined;
        }
    }
    processAction(action, result) {
        switch (action.type) {
            case 'assign_to_user':
                result.assigneeId = action.value;
                break;
            case 'assign_to_role':
                result.assigneeRole = action.value;
                break;
            case 'add_tags':
                if (Array.isArray(action.value)) {
                    result.additionalTags.push(...action.value);
                }
                else {
                    result.additionalTags.push(action.value);
                }
                break;
            case 'set_priority':
                result.newPriority = action.value;
                break;
            case 'send_notification':
                result.notifications.push({
                    type: action.metadata?.type || 'standard',
                    recipient: action.value,
                    message: action.metadata?.message,
                });
                break;
            case 'escalate':
                result.shouldEscalate = true;
                break;
            case 'auto_respond':
                result.autoResponseMessage = action.value;
                break;
        }
    }
    getStats(organizationId) {
        const rules = Array.from(routingRules.values()).filter(r => r.organizationId === organizationId);
        const totalMatches = rules.reduce((sum, r) => sum + r.matchCount, 0);
        const topMatchedRules = [...rules]
            .sort((a, b) => b.matchCount - a.matchCount)
            .slice(0, 5)
            .map(r => ({
            ruleId: r.id,
            ruleName: r.name,
            matchCount: r.matchCount,
        }));
        return {
            totalRules: rules.length,
            activeRules: rules.filter(r => r.isActive).length,
            inactiveRules: rules.filter(r => !r.isActive).length,
            totalMatches,
            topMatchedRules,
        };
    }
    async getStatsAsync(organizationId) {
        await this.loadOrganizationRules(organizationId);
        return this.getStats(organizationId);
    }
    validateRule(dto) {
        const errors = [];
        if (!dto.name || dto.name.trim() === '') {
            errors.push('Rule name is required');
        }
        if (!dto.conditions || dto.conditions.length === 0) {
            errors.push('At least one condition is required');
        }
        if (!dto.actions || dto.actions.length === 0) {
            errors.push('At least one action is required');
        }
        for (const condition of dto.conditions || []) {
            if (!condition.field) {
                errors.push('Condition field is required');
            }
            if (!condition.operator) {
                errors.push('Condition operator is required');
            }
            if (condition.value === undefined || condition.value === null) {
                errors.push('Condition value is required');
            }
        }
        for (const action of dto.actions || []) {
            if (!action.type) {
                errors.push('Action type is required');
            }
            if (action.value === undefined || action.value === null) {
                errors.push('Action value is required');
            }
        }
        return { valid: errors.length === 0, errors };
    }
    testRule(rule, ticket) {
        const testRule = {
            ...rule,
            id: 'test-rule',
            createdAt: new Date(),
            updatedAt: new Date(),
            matchCount: 0,
        };
        const matched = this.evaluateRule(testRule, ticket);
        return {
            matched,
            actionsTriggered: matched ? testRule.actions : [],
        };
    }
    duplicateRule(ruleId, newName) {
        const source = routingRules.get(ruleId);
        if (!source) {
            throw new Error(`Source rule not found: ${ruleId}`);
        }
        const duplicated = this.createRule({
            name: newName || `${source.name} (Copy)`,
            description: source.description,
            organizationId: source.organizationId,
            priority: source.priority,
            conditions: [...source.conditions],
            conditionLogic: source.conditionLogic,
            actions: [...source.actions],
            createdBy: source.createdBy,
        });
        logger_1.logger.info('Rule duplicated', {
            sourceRuleId: ruleId,
            newRuleId: duplicated.id,
        });
        return duplicated;
    }
    toggleRuleStatus(ruleId) {
        const rule = routingRules.get(ruleId);
        if (!rule) {
            throw new Error(`Rule not found: ${ruleId}`);
        }
        rule.isActive = !rule.isActive;
        rule.updatedAt = new Date();
        logger_1.logger.info('Rule status toggled', {
            ruleId,
            isActive: rule.isActive,
        });
        return rule;
    }
    async toggleRuleStatusAsync(organizationId, ruleId) {
        await this.loadOrganizationRules(organizationId);
        const rule = routingRules.get(ruleId);
        if (rule?.organizationId !== organizationId) {
            throw new Error(`Rule not found: ${ruleId}`);
        }
        const updated = this.toggleRuleStatus(ruleId);
        await this.persistOrganizationRules(organizationId);
        return updated;
    }
    reorderRules(organizationId, ruleOrder) {
        for (const { ruleId, priority } of ruleOrder) {
            const rule = routingRules.get(ruleId);
            if (rule?.organizationId === organizationId) {
                rule.priority = priority;
                rule.updatedAt = new Date();
            }
        }
        logger_1.logger.info('Rules reordered', {
            organizationId,
            rulesUpdated: ruleOrder.length,
        });
    }
    async reorderRulesAsync(organizationId, ruleOrder) {
        await this.loadOrganizationRules(organizationId);
        this.reorderRules(organizationId, ruleOrder);
        await this.persistOrganizationRules(organizationId);
    }
    clearRulesForOrganization(organizationId) {
        const toDelete = [];
        for (const [id, rule] of routingRules.entries()) {
            if (rule.organizationId === organizationId) {
                toDelete.push(id);
            }
        }
        for (const id of toDelete) {
            routingRules.delete(id);
        }
        logger_1.logger.info('Organization rules cleared', {
            organizationId,
            rulesDeleted: toDelete.length,
        });
    }
    async clearRulesForOrganizationAsync(organizationId) {
        await this.loadOrganizationRules(organizationId);
        this.clearRulesForOrganization(organizationId);
        await this.persistOrganizationRules(organizationId);
    }
    getDefaultRules() {
        return [...DEFAULT_RULES];
    }
}
exports.TicketRoutingService = TicketRoutingService;
//# sourceMappingURL=TicketRoutingService.js.map