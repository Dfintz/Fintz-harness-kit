import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Template category
 */
export enum TemplateCategory {
  MILITARY = 'MILITARY',
  CORPORATE = 'CORPORATE',
  GUILD = 'GUILD',
  COMMUNITY = 'COMMUNITY',
  PROJECT = 'PROJECT',
  CUSTOM = 'CUSTOM',
}

/**
 * Template visibility
 */
export enum TemplateVisibility {
  PUBLIC = 'PUBLIC', // Available to all users
  PRIVATE = 'PRIVATE', // Only visible to creator
  ORGANIZATION = 'ORGANIZATION', // Visible to organization members
  MARKETPLACE = 'MARKETPLACE', // Featured in template marketplace
}

/**
 * Template structure definition
 */
export interface TemplateStructure {
  name: string;
  description?: string;
  type: string;
  level: number;
  children?: TemplateStructure[];
  defaultRoles?: string[];
  defaultMemberCount?: number;
}

/**
 * Default role configuration
 */
export interface DefaultRole {
  name: string;
  description?: string;
  permissions: string[]; // Permission template names or custom permissions
  memberCount?: number; // Suggested number of members
  autoAssign?: boolean; // Auto-assign to new members
}

/**
 * Default permission configuration
 */
export interface DefaultPermission {
  resource: string;
  actions: string[];
  scope: string;
  inheritable: boolean;
  priority: number;
  applyToRoles?: string[]; // Which roles get this permission
}

/**
 * Template settings
 */
export interface TemplateSettings {
  allowSubOrgs: boolean;
  maxDepth: number;
  requireApproval: boolean;
  inheritPermissions: boolean;
  autoArchiveInactive: boolean;
  inactivityThreshold?: number; // Days
  visibility: string;
  customFields?: Array<{
    name: string;
    type: string;
    required: boolean;
    defaultValue?: unknown;
  }>;
}

/**
 * Application configuration
 */
export interface ApplicationConfig {
  createSubOrgsByDefault: boolean;
  subOrgDepth?: number;
  assignDefaultRoles: boolean;
  sendWelcomeMessages: boolean;
  enableAnalytics: boolean;
  customizationOptions?: Record<string, unknown>;
  allowApplications?: boolean;
  requireApproval?: boolean;
  autoAssignRole?: string;
  welcomeMessage?: string;
}

/**
 * OrganizationTemplate entity
 * Defines reusable organization templates
 */
@Entity('organization_templates')
export class OrganizationTemplate {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // Basic info
  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({
    type: 'enum',
    enum: TemplateCategory,
    default: TemplateCategory.CUSTOM,
  })
  category: TemplateCategory;

  @Column({
    type: 'enum',
    enum: TemplateVisibility,
    default: TemplateVisibility.PRIVATE,
  })
  visibility: TemplateVisibility;

  // Creator info
  @Column({ type: 'uuid' })
  createdBy: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  creatorName: string | null;

  // Template structure
  @Column({ type: 'jsonb' })
  structure: TemplateStructure;

  // Default roles
  @Column({ type: 'jsonb', default: [] })
  defaultRoles: DefaultRole[];

  // Default permissions
  @Column({ type: 'jsonb', default: [] })
  defaultPermissions: DefaultPermission[];

  // Default settings
  @Column({ type: 'jsonb' })
  defaultSettings: TemplateSettings;

  // Application configuration
  @Column({ type: 'jsonb', default: {} })
  applicationConfig: ApplicationConfig;

  // Tags for searchability
  @Column({ type: 'simple-array', nullable: true })
  tags: string[] | null;

  // Icon/logo
  @Column({ type: 'varchar', length: 500, nullable: true })
  iconUrl: string | null;

  // Usage statistics
  @Column({ type: 'integer', default: 0 })
  usageCount: number;

  @Column({ type: 'decimal', precision: 3, scale: 2, default: 0 })
  averageRating: number;

  @Column({ type: 'integer', default: 0 })
  ratingCount: number;

  // Status
  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'boolean', default: false })
  isFeatured: boolean;

  @Column({ type: 'boolean', default: false })
  isVerified: boolean; // Verified by platform

  @Column({ type: 'boolean', default: false })
  isPublic: boolean; // Public visibility

  // Alias for backward compatibility
  get creatorId(): string {
    return this.createdBy;
  }
  set creatorId(value: string) {
    this.createdBy = value;
  }

  // Version control
  @Column({ type: 'varchar', length: 20, default: '1.0.0' })
  version: string;

  @Column({ type: 'text', nullable: true })
  changelog: string | null;

  // Source template (for forking)
  @Column({ type: 'uuid', nullable: true })
  forkedFrom: string | null;

  @ManyToOne(() => OrganizationTemplate, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'forkedFrom' })
  sourceTemplate: OrganizationTemplate | null;

  // Preview/demo
  @Column({ type: 'jsonb', nullable: true })
  preview: {
    screenshots?: string[];
    demoUrl?: string;
    features?: string[];
    requirements?: string[];
  } | null;

  // Metadata
  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown>;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  lastUsedAt: Date | null;

  /**
   * Calculate depth of template structure
   */
  getMaxDepth(): number {
    const calculateDepth = (node: TemplateStructure, currentDepth: number = 0): number => {
      if (!node.children || node.children.length === 0) {
        return currentDepth;
      }
      return Math.max(...node.children.map(child => calculateDepth(child, currentDepth + 1)));
    };
    return calculateDepth(this.structure);
  }

  /**
   * Count total nodes in template
   */
  getNodeCount(): number {
    const countNodes = (node: TemplateStructure): number => {
      if (!node.children || node.children.length === 0) {
        return 1;
      }
      return 1 + node.children.reduce((sum, child) => sum + countNodes(child), 0);
    };
    return countNodes(this.structure);
  }

  /**
   * Get all roles from template
   */
  getAllRoles(): string[] {
    const roles = new Set<string>();

    // Add default roles
    this.defaultRoles.forEach(role => roles.add(role.name));

    // Add roles from structure
    const extractRoles = (node: TemplateStructure) => {
      if (node.defaultRoles) {
        node.defaultRoles.forEach(role => roles.add(role));
      }
      if (node.children) {
        node.children.forEach(child => extractRoles(child));
      }
    };
    extractRoles(this.structure);

    return Array.from(roles);
  }

  /**
   * Validate template structure
   */
  validateStructure(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!this.structure.name) {
      errors.push('Root structure must have a name');
    }

    const maxDepth = this.getMaxDepth();
    if (maxDepth > 10) {
      errors.push(`Template depth ${maxDepth} exceeds maximum of 10`);
    }

    // Validate all nodes have names
    const validateNode = (node: TemplateStructure, path: string) => {
      if (!node.name) {
        errors.push(`Node at ${path} is missing a name`);
      }
      if (node.children) {
        node.children.forEach((child, index) => {
          validateNode(child, `${path}/${child.name || index}`);
        });
      }
    };
    validateNode(this.structure, 'root');

    // Validate roles have permissions
    this.defaultRoles.forEach((role, index) => {
      if (!role.name) {
        errors.push(`Role at index ${index} is missing a name`);
      }
      if (!role.permissions || role.permissions.length === 0) {
        errors.push(`Role "${role.name}" has no permissions`);
      }
    });

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Get template summary for listings
   */
  getSummary() {
    return {
      id: this.id,
      name: this.name,
      description: this.description,
      category: this.category,
      visibility: this.visibility,
      iconUrl: this.iconUrl,
      usageCount: this.usageCount,
      averageRating: this.averageRating,
      ratingCount: this.ratingCount,
      isFeatured: this.isFeatured,
      isVerified: this.isVerified,
      tags: this.tags,
      maxDepth: this.getMaxDepth(),
      nodeCount: this.getNodeCount(),
      roleCount: this.defaultRoles.length,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }

  /**
   * Increment usage count
   */
  incrementUsage(): void {
    this.usageCount += 1;
    this.lastUsedAt = new Date();
  }

  /**
   * Add rating
   */
  addRating(rating: number): void {
    const totalRating = this.averageRating * this.ratingCount + rating;
    this.ratingCount += 1;
    this.averageRating = totalRating / this.ratingCount;
  }

  /**
   * Create a fork of this template
   */
  fork(newName: string, userId: string): Partial<OrganizationTemplate> {
    return {
      name: newName,
      description: `Forked from ${this.name}`,
      category: this.category,
      visibility: TemplateVisibility.PRIVATE,
      createdBy: userId,
      structure: JSON.parse(JSON.stringify(this.structure)),
      defaultRoles: JSON.parse(JSON.stringify(this.defaultRoles)),
      defaultPermissions: JSON.parse(JSON.stringify(this.defaultPermissions)),
      defaultSettings: JSON.parse(JSON.stringify(this.defaultSettings)),
      applicationConfig: JSON.parse(JSON.stringify(this.applicationConfig)),
      tags: this.tags ? [...this.tags] : null,
      forkedFrom: this.id,
      version: '1.0.0',
      metadata: { forkedFromVersion: this.version },
    };
  }

  /**
   * Export template as JSON
   */
  export(): object {
    return {
      name: this.name,
      description: this.description,
      category: this.category,
      structure: this.structure,
      defaultRoles: this.defaultRoles,
      defaultPermissions: this.defaultPermissions,
      defaultSettings: this.defaultSettings,
      applicationConfig: this.applicationConfig,
      tags: this.tags,
      version: this.version,
      metadata: this.metadata,
    };
  }

  /**
   * Check if user can use this template
   */
  canBeUsedBy(userId: string, _userOrgId?: string): boolean {
    // Creator can always use
    if (this.createdBy === userId) {
      return true;
    }

    // Check visibility
    switch (this.visibility) {
      case TemplateVisibility.PUBLIC:
      case TemplateVisibility.MARKETPLACE:
        return this.isActive;
      case TemplateVisibility.PRIVATE:
        return false;
      case TemplateVisibility.ORGANIZATION:
        // Would need to check if user is in same org as creator
        // This requires additional context not available here
        return false;
      default:
        return false;
    }
  }
}
