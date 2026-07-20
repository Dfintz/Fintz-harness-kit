import { apiClient } from './apiClient';
import { BaseService } from './baseService';

/**
 * Ticket Category
 */
export enum TicketCategory {
  HR = 'hr',
  RECRUITMENT = 'recruitment',
  DIPLOMACY = 'diplomacy',
  GENERAL = 'general',
  SUPPORT = 'support',
}

/**
 * Ticket Priority
 */
export enum TicketPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  URGENT = 'urgent',
}

/**
 * Ticket Status
 */
export enum TicketStatus {
  OPEN = 'open',
  IN_PROGRESS = 'in_progress',
  AWAITING_RESPONSE = 'awaiting_response',
  ON_HOLD = 'on_hold',
  RESOLVED = 'resolved',
  CLOSED = 'closed',
}

/**
 * Ticket Recipient Type - Dynamic routing for who the ticket is directed to
 */
export enum TicketRecipientType {
  // Role-based
  ORG_LEADERSHIP = 'org_leadership',
  ORG_OFFICERS = 'org_officers',
  TEAM_LEADER = 'team_leader',
  ALLIANCE_COUNCIL = 'alliance_council',
  // Function-based
  HR_DEPARTMENT = 'hr_department',
  RECRUITMENT = 'recruitment',
  DIPLOMACY = 'diplomacy',
  // Direct
  SPECIFIC_USER = 'specific_user',
  PLATFORM_ADMIN = 'platform_admin',
}

/**
 * Ticket Message
 */
export interface TicketMessage {
  id: string;
  authorId: string;
  authorName: string;
  content: string;
  createdAt: Date;
  isInternal: boolean;
  attachments?: string[];
}

/**
 * Ticket Assignment
 */
export interface TicketAssignment {
  assigneeId: string;
  assigneeName: string;
  assignedAt: Date;
  assignedBy: string;
}

/**
 * Discord Settings for Ticket
 */
export interface TicketDiscordSettings {
  enabled: boolean;
  channelId?: string;
  threadId?: string;
  notifyOnUpdate: boolean;
  roleId?: string;
  webhookUrl?: string;
}

/**
 * Ticket
 */
export interface Ticket {
  id: string;
  ticketNumber: string;
  subject: string;
  description: string;
  category: TicketCategory;
  priority: TicketPriority;
  status: TicketStatus;
  creatorId: string;
  creatorName: string;
  creatorDiscordId?: string;
  creatorEmail?: string;
  recipientType?: TicketRecipientType;
  recipientId?: string;
  recipientName?: string;
  assigneeId?: string;
  assigneeName?: string;
  assignmentHistory: TicketAssignment[];
  messages: TicketMessage[];
  discordSettings?: TicketDiscordSettings;
  discordChannelId?: string;
  discordThreadId?: string;
  relatedRecruitmentId?: string;
  relatedDiplomacyId?: string;
  relatedApplicationId?: string;
  tags: string[];
  resolution?: string;
  resolvedAt?: Date;
  resolvedBy?: string;
  satisfactionRating?: number;
  feedback?: string;
  dueDate?: Date;
  slaBreached: boolean;
  firstResponseAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  closedAt?: Date;
}

/**
 * Create Ticket Request
 */
export interface CreateTicketRequest {
  subject: string;
  description: string;
  category: TicketCategory;
  priority?: TicketPriority;
  recipientType: TicketRecipientType;
  recipientId?: string;
  recipientName?: string;
  discordId?: string;
  email?: string;
  tags?: string[];
  relatedRecruitmentId?: string;
  relatedDiplomacyId?: string;
  relatedApplicationId?: string;
}

/**
 * Update Ticket Request
 */
export interface UpdateTicketRequest {
  subject?: string;
  description?: string;
  category?: TicketCategory;
  priority?: TicketPriority;
  status?: TicketStatus;
  tags?: string[];
  dueDate?: Date;
}

/**
 * Add Message Request
 */
export interface AddMessageRequest {
  content: string;
  isInternal?: boolean;
  attachments?: string[];
}

/**
 * Assign Ticket Request
 */
export interface AssignTicketRequest {
  assigneeId: string;
  assigneeName: string;
}

/**
 * Resolve Ticket Request
 */
export interface ResolveTicketRequest {
  resolution: string;
}

/**
 * Add Feedback Request
 */
export interface AddFeedbackRequest {
  rating: number;
  feedback?: string;
}

/**
 * Ticket Query Filters
 */
export interface TicketQueryFilters {
  page?: number;
  limit?: number;
  category?: TicketCategory;
  status?: string;
  priority?: TicketPriority;
  assigneeId?: string;
  creatorId?: string;
  searchTerm?: string;
}

/**
 * Ticket Statistics
 */
export interface TicketStats {
  total: number;
  open: number;
  inProgress: number;
  resolved: number;
  closed: number;
  byCategory: Record<TicketCategory, number>;
  byPriority: Record<TicketPriority, number>;
  averageResponseTimeMs: number | null;
  averageSatisfactionRating: number | null;
}

/**
 * Paginated Response
 */
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/**
 * Ticket Service
 * Handles all ticket-related API calls
 */
class TicketService extends BaseService {
  protected basePath = '/api/v2/tickets';

  /**
   * Get list of tickets with optional filters
   */
  async getTickets(filters?: TicketQueryFilters): Promise<PaginatedResponse<Ticket>> {
    try {
      this.log('getTickets', filters);
      const response = await apiClient.get<PaginatedResponse<Ticket>>(this.basePath, {
        params: filters,
      });
      return response.data;
    } catch (error) {
      this.handleError(error, 'getTickets');
    }
  }

  /**
   * Get a single ticket by ID
   */
  async getTicket(id: string): Promise<Ticket> {
    try {
      this.log('getTicket', { id });
      const response = await apiClient.get<Ticket>(`${this.basePath}/${id}`);
      return response.data;
    } catch (error) {
      this.handleError(error, 'getTicket');
    }
  }

  /**
   * Get a single ticket by ticket number (e.g., TKT-000001)
   */
  async getTicketByNumber(ticketNumber: string): Promise<Ticket> {
    try {
      this.log('getTicketByNumber', { ticketNumber });
      const response = await apiClient.get<Ticket>(`${this.basePath}/by-number/${ticketNumber}`);
      return response.data;
    } catch (error) {
      this.handleError(error, 'getTicketByNumber');
    }
  }

  /**
   * Create a new ticket
   */
  async createTicket(data: CreateTicketRequest): Promise<Ticket> {
    try {
      this.log('createTicket', data);
      const response = await apiClient.post<Ticket>(this.basePath, data);
      return response.data;
    } catch (error) {
      this.handleError(error, 'createTicket');
    }
  }

  /**
   * Update a ticket
   */
  async updateTicket(id: string, data: UpdateTicketRequest): Promise<Ticket> {
    try {
      this.log('updateTicket', { id, data });
      const response = await apiClient.put<Ticket>(`${this.basePath}/${id}`, data);
      return response.data;
    } catch (error) {
      this.handleError(error, 'updateTicket');
    }
  }

  /**
   * Delete a ticket
   */
  async deleteTicket(id: string): Promise<void> {
    try {
      this.log('deleteTicket', { id });
      await apiClient.delete(`${this.basePath}/${id}`);
    } catch (error) {
      this.handleError(error, 'deleteTicket');
    }
  }

  /**
   * Add a message to a ticket
   */
  async addMessage(ticketId: string, data: AddMessageRequest): Promise<Ticket> {
    try {
      this.log('addMessage', { ticketId, data });
      const response = await apiClient.post<Ticket>(`${this.basePath}/${ticketId}/messages`, data);
      return response.data;
    } catch (error) {
      this.handleError(error, 'addMessage');
    }
  }

  /**
   * Assign a ticket to a user
   */
  async assignTicket(ticketId: string, data: AssignTicketRequest): Promise<Ticket> {
    try {
      this.log('assignTicket', { ticketId, data });
      const response = await apiClient.put<Ticket>(`${this.basePath}/${ticketId}/assign`, data);
      return response.data;
    } catch (error) {
      this.handleError(error, 'assignTicket');
    }
  }

  /**
   * Resolve a ticket
   */
  async resolveTicket(ticketId: string, data: ResolveTicketRequest): Promise<Ticket> {
    try {
      this.log('resolveTicket', { ticketId, data });
      const response = await apiClient.put<Ticket>(`${this.basePath}/${ticketId}/resolve`, data);
      return response.data;
    } catch (error) {
      this.handleError(error, 'resolveTicket');
    }
  }

  /**
   * Close a ticket
   */
  async closeTicket(ticketId: string): Promise<Ticket> {
    try {
      this.log('closeTicket', { ticketId });
      const response = await apiClient.put<Ticket>(`${this.basePath}/${ticketId}/close`);
      return response.data;
    } catch (error) {
      this.handleError(error, 'closeTicket');
    }
  }

  /**
   * Reopen a ticket
   */
  async reopenTicket(ticketId: string): Promise<Ticket> {
    try {
      this.log('reopenTicket', { ticketId });
      const response = await apiClient.put<Ticket>(`${this.basePath}/${ticketId}/reopen`);
      return response.data;
    } catch (error) {
      this.handleError(error, 'reopenTicket');
    }
  }

  /**
   * Add feedback to a ticket
   */
  async addFeedback(ticketId: string, data: AddFeedbackRequest): Promise<Ticket> {
    try {
      this.log('addFeedback', { ticketId, data });
      const response = await apiClient.post<Ticket>(`${this.basePath}/${ticketId}/feedback`, data);
      return response.data;
    } catch (error) {
      this.handleError(error, 'addFeedback');
    }
  }

  /**
   * Get ticket statistics
   */
  async getStats(): Promise<TicketStats> {
    try {
      this.log('getStats');
      const response = await apiClient.get<TicketStats>(`${this.basePath}/stats`);
      return response.data;
    } catch (error) {
      this.handleError(error, 'getStats');
    }
  }
}

export const ticketService = new TicketService();
