import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

@Entity('shared_accounts')
export class SharedAccount {
    @PrimaryGeneratedColumn('uuid')
    id!: string;

    @Column({ type: 'varchar', length: 255 })
    accountName!: string;

    @Column({ type: 'varchar', length: 100 })
    accountUsername!: string;

    @Column({ type: 'text', nullable: true })
    description?: string;

    @Index()
    @Column({ type: 'uuid' })
    organizationId!: string;

    @Column({ type: 'varchar', length: 255 })
    keyVaultSecretName!: string;

    @Column({ type: 'varchar', length: 255, nullable: true })
    twoFactorSecretName?: string; // Key Vault secret name for 2FA secret

    @Column({ type: 'timestamp', nullable: true })
    passwordExpiresAt?: Date;

    @Column({ type: 'simple-array', nullable: true })
    categories?: string[]; // e.g., ['training', 'operations', 'backup']

    @Column({ type: 'simple-array', nullable: true })
    tags?: string[]; // e.g., ['fleet-ops', 'high-priority']

    @Column({ type: 'uuid' })
    createdBy!: string;

    @Column({ type: 'uuid', nullable: true })
    lastAccessedBy?: string;

    @Column({ type: 'timestamp', nullable: true })
    lastAccessedAt?: Date;

    @CreateDateColumn()
    createdAt!: Date;

    @UpdateDateColumn()
    updatedAt!: Date;
}
