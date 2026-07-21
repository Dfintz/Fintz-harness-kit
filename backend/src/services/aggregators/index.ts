/**
 * Service Aggregators
 * Complex multi-service operations that span multiple domains
 *
 * This module provides:
 * - Activity aggregation: Multi-step activity creation, completion, and cancellation
 * - Organization aggregation: Member onboarding, offboarding, and bulk operations
 * - Fleet aggregation: Fleet creation with assets, deployment, and dissolution
 * - Trade aggregation: Trade operations, supply chain analysis, and bulk updates
 * - Saga pattern: Distributed transaction support with automatic compensation
 */

// Activity Aggregator
export { ActivityAggregatorService } from './ActivityAggregatorService';
export type {
  CompleteActivityParams,
  CreateActivityWithParticipantsParams,
} from './ActivityAggregatorService';

// Organization Aggregator
export { OrganizationAggregatorService } from './OrganizationAggregatorService';
export type { InviteMemberParams, OrganizationSetupParams } from './OrganizationAggregatorService';

// Fleet Aggregator (NEW Dec 2025)
export { FleetAggregatorService } from './FleetAggregatorService';
export type {
  CreateFleetWithAssetsParams,
  DeployFleetParams,
  DissolveFleetParams,
  FleetCompositionAnalysis,
} from './FleetAggregatorService';

// Trade Aggregator (NEW Dec 2025)
export { TradeAggregatorService } from './TradeAggregatorService';
export type {
  CreateTradeOperationParams,
  ExecuteTradeRunParams,
  SupplyChainAnalysisParams,
  SupplyChainAnalysisResult,
  TradeOperationResult,
} from './TradeAggregatorService';

// Unified Participant Aggregator (Sprint 19-E)
export { UnifiedParticipantService } from './UnifiedParticipantService';
export type {
  ParticipationQuery,
  ParticipationSummary,
  ParticipationSystemType,
  SystemParticipation,
} from './UnifiedParticipantService';

// LFG-Activity Sync (Sprint 19-F)
export { LFGActivitySyncService } from './LFGActivitySyncService';
export type { LFGSyncOptions, LFGSyncResult } from './LFGActivitySyncService';

// Saga Orchestrator (NEW Dec 2025)
export { createSaga, SagaOrchestrator } from './SagaOrchestrator';
export type { SagaOptions, SagaResult, SagaState, SagaStep, StepResult } from './SagaOrchestrator';

