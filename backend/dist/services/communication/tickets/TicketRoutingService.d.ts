import { TicketCategory, TicketPriority } from '../../../models/Ticket';
export type ConditionOperator = 'equals' | 'not_equals' | 'contains' | 'not_contains' | 'starts_with' | 'ends_with' | 'greater_than' | 'less_than' | 'in_list' | 'not_in_list' | 'matches_regex';
type ConditionOperand = string | string[] | number;
export type ConditionField = 'category' | 'priority' | 'subject' | 'description' | 'tags' | 'creatorDiscordId' | 'creatorEmail';
export interface RoutingCondition {
    field: ConditionField;
    operator: ConditionOperator;
    value: ConditionOperand;
}
export type ActionType = 'assign_to_user' | 'assign_to_role' | 'add_tags' | 'set_priority' | 'send_notification' | 'escalate' | 'auto_respond';
export interface RoutingAction {
    type: ActionType;
    value: string | string[] | TicketPriority;
    metadata?: Record<string, string>;
}
export interface TicketRoutingRule {
    id: string;
    name: string;
    description: string;
    organizationId: string;
    isActive: boolean;
    priority: number;
    conditions: RoutingCondition[];
    conditionLogic: 'AND' | 'OR';
    actions: RoutingAction[];
    createdAt: Date;
    updatedAt: Date;
    createdBy: string;
    matchCount: number;
    lastMatchedAt?: Date;
}
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
export interface RoutingResult {
    matched: boolean;
    matchedRules: TicketRoutingRule[];
    actions: RoutingAction[];
    assigneeId?: string;
    assigneeRole?: string;
    additionalTags: string[];
    newPriority?: TicketPriority;
    notifications: Array<{
        type: string;
        recipient: string;
        message?: string;
    }>;
    shouldEscalate: boolean;
    autoResponseMessage?: string;
}
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
export interface UpdateRoutingRuleDTO {
    name?: string;
    description?: string;
    isActive?: boolean;
    priority?: number;
    conditions?: RoutingCondition[];
    conditionLogic?: 'AND' | 'OR';
    actions?: RoutingAction[];
}
declare const DEFAULT_RULES: Omit<TicketRoutingRule, 'id' | 'organizationId' | 'createdAt' | 'updatedAt' | 'createdBy' | 'matchCount'>[];
export declare class TicketRoutingService {
    private static instance;
    private constructor();
    static getInstance(): TicketRoutingService;
    private getCacheKey;
    private normalizeRule;
    private loadOrganizationRules;
    private persistOrganizationRules;
    createRule(dto: CreateRoutingRuleDTO): TicketRoutingRule;
    createRuleAsync(dto: CreateRoutingRuleDTO): Promise<TicketRoutingRule>;
    updateRule(ruleId: string, dto: UpdateRoutingRuleDTO): TicketRoutingRule;
    updateRuleAsync(organizationId: string, ruleId: string, dto: UpdateRoutingRuleDTO): Promise<TicketRoutingRule>;
    deleteRule(ruleId: string): boolean;
    deleteRuleAsync(organizationId: string, ruleId: string): Promise<boolean>;
    getRule(ruleId: string): TicketRoutingRule | undefined;
    getRuleAsync(organizationId: string, ruleId: string): Promise<TicketRoutingRule | undefined>;
    getRulesForOrganization(organizationId: string): TicketRoutingRule[];
    getRulesForOrganizationAdmin(organizationId: string): TicketRoutingRule[];
    getRulesForOrganizationAsync(organizationId: string): Promise<TicketRoutingRule[]>;
    getRulesForOrganizationAdminAsync(organizationId: string): Promise<TicketRoutingRule[]>;
    evaluateTicket(organizationId: string, ticket: TicketForRouting): RoutingResult;
    evaluateTicketAsync(organizationId: string, ticket: TicketForRouting): Promise<RoutingResult>;
    private evaluateRule;
    private evaluateCondition;
    private evaluateContains;
    private evaluateNotContains;
    private evaluateStringBoundary;
    private evaluateListMembership;
    private evaluateRegex;
    private getTicketFieldValue;
    private processAction;
    getStats(organizationId: string): {
        totalRules: number;
        activeRules: number;
        inactiveRules: number;
        totalMatches: number;
        topMatchedRules: Array<{
            ruleId: string;
            ruleName: string;
            matchCount: number;
        }>;
    };
    getStatsAsync(organizationId: string): Promise<{
        totalRules: number;
        activeRules: number;
        inactiveRules: number;
        totalMatches: number;
        topMatchedRules: Array<{
            ruleId: string;
            ruleName: string;
            matchCount: number;
        }>;
    }>;
    validateRule(dto: CreateRoutingRuleDTO): {
        valid: boolean;
        errors: string[];
    };
    testRule(rule: Omit<TicketRoutingRule, 'id' | 'createdAt' | 'updatedAt' | 'matchCount' | 'lastMatchedAt'>, ticket: TicketForRouting): {
        matched: boolean;
        actionsTriggered: RoutingAction[];
    };
    duplicateRule(ruleId: string, newName?: string): TicketRoutingRule;
    toggleRuleStatus(ruleId: string): TicketRoutingRule;
    toggleRuleStatusAsync(organizationId: string, ruleId: string): Promise<TicketRoutingRule>;
    reorderRules(organizationId: string, ruleOrder: Array<{
        ruleId: string;
        priority: number;
    }>): void;
    reorderRulesAsync(organizationId: string, ruleOrder: Array<{
        ruleId: string;
        priority: number;
    }>): Promise<void>;
    clearRulesForOrganization(organizationId: string): void;
    clearRulesForOrganizationAsync(organizationId: string): Promise<void>;
    getDefaultRules(): typeof DEFAULT_RULES;
}
export {};
//# sourceMappingURL=TicketRoutingService.d.ts.map