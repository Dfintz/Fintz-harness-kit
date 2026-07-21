/**
 * Operation Command types — shared between frontend and backend
 *
 * Implements a hierarchical chain-of-command system for fleet operations:
 *   Ops Owner → Fleet Commanders → Squadron/Crew Leaders → Members
 *
 * Commands flow downward through the chain. Each level can issue commands
 * to the level below. Designed for Wingman AI voice-command integration.
 */

// ---------------------------------------------------------------------------
// Command hierarchy
// ---------------------------------------------------------------------------

/**
 * Rank in the chain of command for an operation.
 * Determines who can issue commands to whom.
 */
export type CommandRank =
  | 'ops_commander' // Operation owner / top-level commander
  | 'fleet_commander' // Fleet-level commander
  | 'squadron_leader' // Squadron or crew leader
  | 'member'; // Regular participant

/**
 * A node in the operation's chain of command tree.
 */
export interface CommandChainNode {
  userId: string;
  userName: string;
  rank: CommandRank;
  /** Which fleet this node commands (fleet_commander level) */
  fleetId?: string;
  fleetName?: string;
  /** Which squadron/crew this node leads (squadron_leader level) */
  squadronName?: string;
  /** Direct subordinates in the chain */
  subordinateIds: string[];
  /** Direct superior in the chain */
  superiorId?: string;
}

/**
 * Full chain-of-command structure for an operation.
 */
export interface OperationCommandChain {
  activityId: string;
  organizationId: string;
  /** The operation commander (top of chain) */
  commanderId: string;
  commanderName: string;
  /** All nodes in the hierarchy, keyed by userId */
  nodes: Record<string, CommandChainNode>;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Commands (orders flowing down the chain)
// ---------------------------------------------------------------------------

/**
 * Priority of an operation command
 */
export type CommandPriority = 'routine' | 'urgent' | 'critical';

/**
 * Type of command issued through the chain
 */
export type OperationCommandType =
  | 'order' // General order (text)
  | 'preflight_check' // Pre-flight readiness check
  | 'move_to' // Navigate to location
  | 'hold_position' // Hold current position
  | 'engage' // Engage target
  | 'disengage' // Break off / retreat
  | 'rally' // Rally at location
  | 'refuel' // Refuel operations
  | 'form_up' // Form formation
  | 'weapons_free' // Weapons free
  | 'weapons_hold' // Weapons hold
  | 'custom'; // Custom command with payload

/**
 * An issued command in the chain of command
 */
export interface OperationCommand {
  id: string;
  activityId: string;
  organizationId: string;
  type: OperationCommandType;
  priority: CommandPriority;
  /** The user who issued this command */
  issuedBy: string;
  issuedByName: string;
  issuedByRank: CommandRank;
  /** Target scope — who receives this command */
  targetScope: CommandTargetScope;
  /** Human-readable command text */
  message: string;
  /** Optional structured payload (e.g., coordinates for move_to) */
  payload?: Record<string, unknown>;
  /** When the command was issued */
  issuedAt: string;
  /** When the command was acknowledged by all targets */
  acknowledgedAt?: string;
  /** Status of the command */
  status: 'issued' | 'acknowledged' | 'completed' | 'cancelled';
  /** Individual acknowledgements */
  acknowledgements: CommandAcknowledgement[];
}

/**
 * Who receives a command
 */
export interface CommandTargetScope {
  /** 'all' = entire chain below issuer, 'fleet' = specific fleet, 'squadron' = specific squad */
  type: 'all' | 'fleet' | 'squadron' | 'individual';
  /** Target fleet ID (when type = 'fleet') */
  fleetId?: string;
  /** Target squadron name (when type = 'squadron') */
  squadronName?: string;
  /** Target user IDs (when type = 'individual') */
  userIds?: string[];
  /** Resolved list of user IDs who should receive this command */
  resolvedRecipientIds: string[];
}

/**
 * A single acknowledgement of a command
 */
export interface CommandAcknowledgement {
  userId: string;
  userName: string;
  acknowledgedAt: string;
  /** Optional response message */
  response?: string;
}

// ---------------------------------------------------------------------------
// API request/response types
// ---------------------------------------------------------------------------

/**
 * Request to set up the chain of command for an operation
 */
export interface SetCommandChainRequest {
  /** Fleet commanders assigned to this operation */
  fleetCommanders: Array<{
    userId: string;
    userName: string;
    fleetId?: string;
    fleetName?: string;
  }>;
  /** Squadron/crew leaders */
  squadronLeaders: Array<{
    userId: string;
    userName: string;
    squadronName: string;
    /** Which fleet commander this leader reports to */
    reportsToUserId: string;
  }>;
}

/**
 * Request to issue a command
 */
export interface IssueCommandRequest {
  type: OperationCommandType;
  priority?: CommandPriority;
  message: string;
  targetScope: {
    type: 'all' | 'fleet' | 'squadron' | 'individual';
    fleetId?: string;
    squadronName?: string;
    userIds?: string[];
  };
  payload?: Record<string, unknown>;
}

/**
 * Request to acknowledge a command
 */
export interface AcknowledgeCommandRequest {
  response?: string;
}

/**
 * Summary of a command for list views
 */
export interface CommandSummary {
  id: string;
  type: OperationCommandType;
  priority: CommandPriority;
  message: string;
  issuedByName: string;
  issuedAt: string;
  status: 'issued' | 'acknowledged' | 'completed' | 'cancelled';
  totalRecipients: number;
  acknowledgedCount: number;
}
