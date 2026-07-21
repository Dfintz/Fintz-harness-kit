/**
 * Tickets Sub-module
 * Part of the Communication domain
 */

export { TicketService } from './TicketService';
export type { CreateTicketDTO, UpdateTicketDTO, TicketFilters, AddMessageDTO, ResolveTicketDTO } from './TicketService';

export { TicketTemplateService } from './TicketTemplateService';
export type { 
    TicketTemplate, 
    TicketTemplateField, 
    CreateFromTemplateOptions, 
    TicketFromTemplate 
} from './TicketTemplateService';

export { TicketRoutingService } from './TicketRoutingService';
export type {
    TicketRoutingRule,
    RoutingCondition,
    RoutingAction,
    RoutingResult,
    TicketForRouting,
    CreateRoutingRuleDTO,
    UpdateRoutingRuleDTO,
    ConditionOperator,
    ConditionField,
    ActionType
} from './TicketRoutingService';

