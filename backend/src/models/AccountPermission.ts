import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

@Entity('account_permissions')
export class AccountPermission {
    @PrimaryGeneratedColumn('uuid')
    id!: string;

    @Index()
    @Column({ type: 'uuid' })
    userId!: string;

    @Index()
    @Column({ type: 'uuid' })
    organizationId!: string;

    @Column({ type: 'uuid', nullable: true })
    accountId?: string; // If null, applies to all accounts in org

    @Column({ type: 'varchar', length: 50 })
    action!: string; // 'create', 'read', 'update', 'delete', 'reveal_password', 'manage_permissions'

    @Column({ default: true })
    granted!: boolean;

    @Column({ type: 'uuid', nullable: true })
    grantedBy?: string;

    @Column({ type: 'timestamp', nullable: true })
    expiresAt?: Date;

    @CreateDateColumn()
    createdAt!: Date;

    @UpdateDateColumn()
    updatedAt!: Date;
}
