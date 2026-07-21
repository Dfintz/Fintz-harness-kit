import crypto from 'node:crypto';

import { TicketCategory, TicketPriority } from '../../../models/Ticket';
import { logger } from '../../../utils/logger';
import { cache } from '../../../utils/redis';

/**
 * Routing rule condition operators
 */
export type ConditionOperator =
  | 'equals'
  | 'not_equals'
  | 'contains'
  | 'not_contains'
  | 'starts_with'
  | 'ends_with'
  | 'greater_than'
  | 'less_than'
  | 'in_list'
  | 'not_in_list'
  | 'matches_regex';

type ConditionOperand = string | string[] | number;
type TicketFieldValue = string | string[] | undefined;

/**
 * Routing rule condition field
 */
export type ConditionField =
  | 'category'
  | 'priority'
  | 'subject'
  | 'description'
  | 'tags'
  | 'creatorDiscordId'
  | 'creatorEmail';

/**
 * Routing rule condition
 */
export interface RoutingCondition {
  field: ConditionField;
  operator: ConditionOperator;
  value: ConditionOperand;
}

/**
 * Routing rule action types
 */
export type ActionType =
  | 'assign_to_user'
  | 'assign_to_role'
  | 'add_tags'
  | 'set_priority'
  | 'send_notification'
  | 'escalate'
  | 'auto_respond';

/**
 * Routing rule action
 */
export interface RoutingAction {
  type: ActionType;
  value: string | string[] | TicketPriority;
  metadata?: Record<string, string>;
}

/**
 * Ticket routing rule
 */
export interface TicketRoutingRule {
  id: string;
  name: string;
  description: string;
  organizationId: string;
  isActive: boolean;
  priority: number; // Lower number = higher priority
  conditions: RoutingCondition[];
  conditionLogic: 'AND' | 'OR'; // How to combine multiple conditions
  actions: RoutingAction[];
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  matchCount: number; // Track how many times this rule matched
  lastMatchedAt?: Date;
}

/**
 * Ticket data for routing evaluation
 */
export interface TicketForRouting {
  category: TicketCategory;
  priority: TicketPriority;
  subject: string;
  description: string;
  tags: string[];
  creatorId: string;
  creatorDiscordId?: string;
  creatorEmail?: string;
}

/**
 * Routing result from rule evaluation
 */
export interface RoutingResult {
  matched: boolean;
  matchedRules: TicketRoutingRule[];
  actions: RoutingAction[];
  assigneeId?: string;
  assigneeRole?: string;
  additionalTags: string[];
  newPriority?: TicketPriority;
  notifications: Array<{ type: string; recipient: string; message?: string }>;
  shouldEscalate: boolean;
  autoResponseMessage?: string;
}

/**
 * Create routing rule DTO
 */
export interface CreateRoutingRuleDTO {
  name: string;
  description: string;
  organizationId: string;
  priority?: number;
  conditions: RoutingCondition[];
  conditionLogic?: 'AND' | 'OR';
  actions: RoutingAction[];
  createdBy: string;
}

/**
 * Update routing rule DTO
 */
export interface UpdateRoutingRuleDTO {
  name?: string;
  description?: string;
  isActive?: boolean;
  priority?: number;
  conditions?: RoutingCondition[];
  conditionLogic?: 'AND' | 'OR';
  actions?: RoutingAction[];
}

// Rules stored in memory (in production, this would be in the database)
const routingRules: Map<string, TicketRoutingRule> = new Map();
const loadedOrganizations: Set<string> = new Set();
const ROUTING_RULES_TTL_SECONDS = 60 * 60 * 24 * 30;

// Default routing rules that apply to all organizations
const DEFAULT_RULES: Omit<
  TicketRoutingRule,
  'id' | 'organizationId' | 'createdAt' | 'updatedAt' | 'createdBy' | 'matchCount'
>[] = [
  {
    name: 'Urgent Priority Escalation',
    description: 'Automatically escalate urgent priority tickets',
    isActive: true,
    priority: 1,
    conditions: [{ field: 'priority', operator: 'equals', value: TicketPriority.URGENT }],
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
    conditions: [{ field: 'category', operator: 'equals', value: TicketCategory.RECRUITMENT }],
    conditionLogic: 'AND',
    actions: [{ type: 'assign_to_role', value: 'Recruitment Officer' }],
  },
  {
    name: 'Diplomacy Auto-Assignment',
    description: 'Route diplomacy tickets to diplomats',
    isActive: true,
    priority: 10,
    conditions: [{ field: 'category', operator: 'equals', value: TicketCategory.DIPLOMACY }],
    conditionLogic: 'AND',
    actions: [
      { type: 'assign_to_role', value: 'Diplomat' },
      { type: 'set_priority', value: TicketPriority.HIGH },
    ],
  },
  {
    name: 'HR Confidential Handling',
    description: 'Route HR tickets with special handling',
    isActive: true,
    priority: 5,
    conditions: [{ field: 'category', operator: 'equals', value: TicketCategory.HR }],
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
      { type: 'set_priority', value: TicketPriority.URGENT },
      { type: 'add_tags', value: ['harassment', 'urgent-review'] },
      { type: 'send_notification', value: 'hr-manager', metadata: { type: 'urgent' } },
    ],
  },
];

/**
 * Ticket Routing Service
 * Implements rule-based ticket routing for automated ticket assignment and handling
 *
 * Improvement #2 from Ticket Domain review:
 * "Implement rule-based ticket routing"
 */
export class TicketRoutingService {
  private static instance: TicketRoutingService;

  private constructor() {
    logger.info('TicketRoutingService initialized');
  }

  public static getInstance(): TicketRoutingService {
    if (!TicketRoutingService.instance) {
      TicketRoutingService.instance = new TicketRoutingService();
    }
    return TicketRoutingService.instance;
  }

  private getCacheKey(organizationId: string): string {
    return `tickets:routing-rules:${organizationId}`;
  }

  private normalizeRule(rule: TicketRoutingRule): TicketRoutingRule {
    return {
      ...rule,
      createdAt: new Date(rule.createdAt),
      updatedAt: new Date(rule.updatedAt),
      lastMatchedAt: rule.lastMatchedAt ? new Date(rule.lastMatchedAt) : undefined,
    };
  }

  private async loadOrganizationRules(organizationId: string): Promise<void> {
    if (loadedOrganizations.has(organizationId)) {
      return;
    }

    const cachedRules = await cache.get<TicketRoutingRule[]>(this.getCacheKey(organizationId));
    if (cachedRules && Array.isArray(cachedRules)) {
      for (const rawRule of cachedRules) {
        const rule = this.normalizeRule(rawRule);
        routingRules.set(rule.id, rule);
      }
      logger.info('Loaded routing rules from cache', {
        organizationId,
        count: cachedRules.length,
      });
    }

    loadedOrganizations.add(organizationId);
  }

  private async persistOrganizationRules(organizationId: string): Promise<void> {
    const orgRules = Array.from(routingRules.values()).filter(
      r => r.organizationId === organizationId
    );
    const persisted = await cache.set(
      this.getCacheKey(organizationId),
      orgRules,
      ROUTING_RULES_TTL_SECONDS
    );

    if (!persisted) {
      logger.warn('Failed to persist routing rules to cache', {
        organizationId,
        count: orgRules.length,
      });
    }
  }

  /**
   * Create a new routing rule
   */
  public createRule(dto: CreateRoutingRuleDTO): TicketRoutingRule {
    const ruleId = `rule-${dto.organizationId}-${crypto.randomUUID()}`;
    const now = new Date();

    const rule: TicketRoutingRule = {
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

    logger.info('Routing rule created', {
      ruleId,
      ruleName: dto.name,
      organizationId: dto.organizationId,
    });

    return rule;
  }

  public async createRuleAsync(dto: CreateRoutingRuleDTO): Promise<TicketRoutingRule> {
    await this.loadOrganizationRules(dto.organizationId);
    const rule = this.createRule(dto);
    await this.persistOrganizationRules(dto.organizationId);
    return rule;
  }

  /**
   * Update an existing routing rule
   */
  public updateRule(ruleId: string, dto: UpdateRoutingRuleDTO): TicketRoutingRule {
    const existing = routingRules.get(ruleId);

    if (!existing) {
      throw new Error(`Routing rule not found: ${ruleId}`);
    }

    const updated: TicketRoutingRule = {
      ...existing,
      ...dto,
      id: ruleId, // Ensure ID doesn't change
      updatedAt: new Date(),
    };

    routingRules.set(ruleId, updated);

    logger.info('Routing rule updated', { ruleId });

    return updated;
  }

  public async updateRuleAsync(
    organizationId: string,
    ruleId: string,
    dto: UpdateRoutingRuleDTO
  ): Promise<TicketRoutingRule> {
    await this.loadOrganizationRules(organizationId);
    const existing = routingRules.get(ruleId);
    if (existing?.organizationId !== organizationId) {
      throw new Error(`Routing rule not found: ${ruleId}`);
    }
    const updated = this.updateRule(ruleId, dto);
    await this.persistOrganizationRules(organizationId);
    return updated;
  }

  /**
   * Delete a routing rule
   */
  public deleteRule(ruleId: string): boolean {
    const deleted = routingRules.delete(ruleId);

    if (deleted) {
      logger.info('Routing rule deleted', { ruleId });
    }

    return deleted;
  }

  public async deleteRuleAsync(organizationId: string, ruleId: string): Promise<boolean> {
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

  /**
   * Get a specific rule by ID
   */
  public getRule(ruleId: string): TicketRoutingRule | undefined {
    return routingRules.get(ruleId);
  }

  public async getRuleAsync(
    organizationId: string,
    ruleId: string
  ): Promise<TicketRoutingRule | undefined> {
    await this.loadOrganizationRules(organizationId);
    const rule = this.getRule(ruleId);
    if (rule?.organizationId !== organizationId) {
      return undefined;
    }
    return rule;
  }

  /**
   * Get all rules for an organization (including defaults)
   */
  public getRulesForOrganization(organizationId: string): TicketRoutingRule[] {
    // Get organization-specific rules
    const orgRules = Array.from(routingRules.values()).filter(
      r => r.organizationId === organizationId
    );

    // Get default rules with generated IDs
    const defaultRulesWithIds = DEFAULT_RULES.map((rule, index) => ({
      ...rule,
      id: `default-${index}`,
      organizationId: 'system',
      createdAt: new Date('2025-01-01'),
      updatedAt: new Date('2025-01-01'),
      createdBy: 'system',
      matchCount: 0,
    }));

    // Combine and sort by priority
    return [...defaultRulesWithIds, ...orgRules]
      .filter(r => r.isActive)
      .sort((a, b) => a.priority - b.priority);
  }

  public getRulesForOrganizationAdmin(organizationId: string): TicketRoutingRule[] {
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

  public async getRulesForOrganizationAsync(organizationId: string): Promise<TicketRoutingRule[]> {
    await this.loadOrganizationRules(organizationId);
    return this.getRulesForOrganization(organizationId);
  }

  public async getRulesForOrganizationAdminAsync(
    organizationId: string
  ): Promise<TicketRoutingRule[]> {
    await this.loadOrganizationRules(organizationId);
    return this.getRulesForOrganizationAdmin(organizationId);
  }

  /**
   * Evaluate a ticket against routing rules
   */
  public evaluateTicket(organizationId: string, ticket: TicketForRouting): RoutingResult {
    const rules = this.getRulesForOrganization(organizationId);
    const result: RoutingResult = {
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

        // Update rule match count (in production, this would be persisted)
        const stored = routingRules.get(rule.id);
        if (stored) {
          stored.matchCount++;
          stored.lastMatchedAt = new Date();
        }

        // Process actions
        for (const action of rule.actions) {
          this.processAction(action, result);
        }
      }
    }

    logger.info('Ticket routing evaluated', {
      organizationId,
      matched: result.matched,
      matchedRulesCount: result.matchedRules.length,
      actionsCount: result.actions.length,
    });

    return result;
  }

  public async evaluateTicketAsync(
    organizationId: string,
    ticket: TicketForRouting
  ): Promise<RoutingResult> {
    await this.loadOrganizationRules(organizationId);
    const result = this.evaluateTicket(organizationId, ticket);
    if (result.matchedRules.some(rule => !rule.id.startsWith('default-'))) {
      await this.persistOrganizationRules(organizationId);
    }
    return result;
  }

  /**
   * Evaluate a single rule against a ticket
   */
  private evaluateRule(rule: TicketRoutingRule, ticket: TicketForRouting): boolean {
    const conditionResults = rule.conditions.map(condition =>
      this.evaluateCondition(condition, ticket)
    );

    if (rule.conditionLogic === 'AND') {
      return conditionResults.every(Boolean);
    } else {
      return conditionResults.some(Boolean);
    }
  }

  /**
   * Evaluate a single condition against a ticket
   */
  private evaluateCondition(condition: RoutingCondition, ticket: TicketForRouting): boolean {
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

  private evaluateContains(
    ticketValue: TicketFieldValue,
    conditionValue: ConditionOperand
  ): boolean {
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

  private evaluateNotContains(
    ticketValue: TicketFieldValue,
    conditionValue: ConditionOperand
  ): boolean {
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

  private evaluateStringBoundary(
    ticketValue: TicketFieldValue,
    conditionValue: ConditionOperand,
    operator: 'starts_with' | 'ends_with'
  ): boolean {
    if (typeof ticketValue !== 'string' || typeof conditionValue !== 'string') {
      return false;
    }

    const source = ticketValue.toLowerCase();
    const needle = conditionValue.toLowerCase();
    return operator === 'starts_with' ? source.startsWith(needle) : source.endsWith(needle);
  }

  private evaluateListMembership(
    ticketValue: TicketFieldValue,
    conditionValue: ConditionOperand,
    include: boolean
  ): boolean {
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

  private evaluateRegex(ticketValue: TicketFieldValue, conditionValue: ConditionOperand): boolean {
    if (typeof ticketValue !== 'string' || typeof conditionValue !== 'string') {
      return false;
    }

    try {
      const regex = new RegExp(conditionValue, 'i');
      return regex.test(ticketValue);
    } catch {
      return false;
    }
  }

  /**
   * Get the value of a ticket field for condition evaluation
   */
  private getTicketFieldValue(ticket: TicketForRouting, field: ConditionField): TicketFieldValue {
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

  /**
   * Process a routing action and update the result
   */
  private processAction(action: RoutingAction, result: RoutingResult): void {
    switch (action.type) {
      case 'assign_to_user':
        result.assigneeId = action.value as string;
        break;

      case 'assign_to_role':
        result.assigneeRole = action.value as string;
        break;

      case 'add_tags':
        if (Array.isArray(action.value)) {
          result.additionalTags.push(...action.value);
        } else {
          result.additionalTags.push(action.value);
        }
        break;

      case 'set_priority':
        result.newPriority = action.value as TicketPriority;
        break;

      case 'send_notification':
        result.notifications.push({
          type: action.metadata?.type || 'standard',
          recipient: action.value as string,
          message: action.metadata?.message,
        });
        break;

      case 'escalate':
        result.shouldEscalate = true;
        break;

      case 'auto_respond':
        result.autoResponseMessage = action.value as string;
        break;
    }
  }

  /**
   * Get routing rule statistics for an organization
   */
  public getStats(organizationId: string): {
    totalRules: number;
    activeRules: number;
    inactiveRules: number;
    totalMatches: number;
    topMatchedRules: Array<{ ruleId: string; ruleName: string; matchCount: number }>;
  } {
    const rules = Array.from(routingRules.values()).filter(
      r => r.organizationId === organizationId
    );

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

  public async getStatsAsync(organizationId: string): Promise<{
    totalRules: number;
    activeRules: number;
    inactiveRules: number;
    totalMatches: number;
    topMatchedRules: Array<{ ruleId: string; ruleName: string; matchCount: number }>;
  }> {
    await this.loadOrganizationRules(organizationId);
    return this.getStats(organizationId);
  }

  /**
   * Validate a routing rule configuration
   */
  public validateRule(dto: CreateRoutingRuleDTO): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

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

  /**
   * Test a rule against sample ticket data without persisting
   */
  public testRule(
    rule: Omit<
      TicketRoutingRule,
      'id' | 'createdAt' | 'updatedAt' | 'matchCount' | 'lastMatchedAt'
    >,
    ticket: TicketForRouting
  ): { matched: boolean; actionsTriggered: RoutingAction[] } {
    const testRule: TicketRoutingRule = {
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

  /**
   * Duplicate an existing rule
   */
  public duplicateRule(ruleId: string, newName?: string): TicketRoutingRule {
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

    logger.info('Rule duplicated', {
      sourceRuleId: ruleId,
      newRuleId: duplicated.id,
    });

    return duplicated;
  }

  /**
   * Toggle rule active status
   */
  public toggleRuleStatus(ruleId: string): TicketRoutingRule {
    const rule = routingRules.get(ruleId);

    if (!rule) {
      throw new Error(`Rule not found: ${ruleId}`);
    }

    rule.isActive = !rule.isActive;
    rule.updatedAt = new Date();

    logger.info('Rule status toggled', {
      ruleId,
      isActive: rule.isActive,
    });

    return rule;
  }

  public async toggleRuleStatusAsync(
    organizationId: string,
    ruleId: string
  ): Promise<TicketRoutingRule> {
    await this.loadOrganizationRules(organizationId);
    const rule = routingRules.get(ruleId);
    if (rule?.organizationId !== organizationId) {
      throw new Error(`Rule not found: ${ruleId}`);
    }
    const updated = this.toggleRuleStatus(ruleId);
    await this.persistOrganizationRules(organizationId);
    return updated;
  }

  /**
   * Reorder rules by updating priorities
   */
  public reorderRules(
    organizationId: string,
    ruleOrder: Array<{ ruleId: string; priority: number }>
  ): void {
    for (const { ruleId, priority } of ruleOrder) {
      const rule = routingRules.get(ruleId);
      if (rule?.organizationId === organizationId) {
        rule.priority = priority;
        rule.updatedAt = new Date();
      }
    }

    logger.info('Rules reordered', {
      organizationId,
      rulesUpdated: ruleOrder.length,
    });
  }

  public async reorderRulesAsync(
    organizationId: string,
    ruleOrder: Array<{ ruleId: string; priority: number }>
  ): Promise<void> {
    await this.loadOrganizationRules(organizationId);
    this.reorderRules(organizationId, ruleOrder);
    await this.persistOrganizationRules(organizationId);
  }

  /**
   * Clear all rules for an organization (for testing)
   */
  public clearRulesForOrganization(organizationId: string): void {
    const toDelete: string[] = [];

    for (const [id, rule] of routingRules.entries()) {
      if (rule.organizationId === organizationId) {
        toDelete.push(id);
      }
    }

    for (const id of toDelete) {
      routingRules.delete(id);
    }

    logger.info('Organization rules cleared', {
      organizationId,
      rulesDeleted: toDelete.length,
    });
  }

  public async clearRulesForOrganizationAsync(organizationId: string): Promise<void> {
    await this.loadOrganizationRules(organizationId);
    this.clearRulesForOrganization(organizationId);
    await this.persistOrganizationRules(organizationId);
  }

  /**
   * Get default rules (for reference/cloning)
   */
  public getDefaultRules(): typeof DEFAULT_RULES {
    return [...DEFAULT_RULES];
  }
}
