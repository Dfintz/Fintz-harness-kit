import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

/**
 * Permission entity for granular access control
 * Supports resource-level permissions with security levels
 */
@Entity('permissions')
export class Permission {
    @PrimaryGeneratedColumn('uuid')
    id!: string;

    @Index()
    @Column()
    userId!: string;

    @Index()
    @Column()
    organizationId!: string;

    @Column()
    resource!: string; // e.g., 'events', 'ships', 'missions', 'fleets'

    @Column()
    action!: string; // e.g., 'create', 'read', 'update', 'delete', 'share'

    @Column({ default: false })
    granted!: boolean;

    @Column({ nullable: true })
    grantedBy?: string; // User ID who granted this permission

    @Column({ type: 'timestamp', nullable: true })
    expiresAt?: Date;

    @Column({ type: 'json', nullable: true })
    conditions?: Record<string, unknown>; // Additional conditions for the permission

    @CreateDateColumn()
    createdAt!: Date;

    @UpdateDateColumn()
    updatedAt!: Date;
}
