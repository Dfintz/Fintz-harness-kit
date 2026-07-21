import { Entity, PrimaryColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

export enum MaintenanceStatus {
    SCHEDULED = 'scheduled',
    IN_PROGRESS = 'in_progress',
    COMPLETED = 'completed',
    CANCELLED = 'cancelled',
    OVERDUE = 'overdue'
}

export enum MaintenanceType {
    ROUTINE = 'routine',
    REPAIR = 'repair',
    UPGRADE = 'upgrade',
    INSPECTION = 'inspection'
}

@Entity('ship_maintenance')
export class ShipMaintenance {
    @PrimaryColumn()
    id!: string;

    @Column()
    shipId!: string;

    @Column()
    ownerId!: string;

    @Column({
        type: 'varchar'
    })
    maintenanceType!: MaintenanceType;

    @Column()
    scheduledDate!: Date;

    @Column({ nullable: true })
    completedDate?: Date;

    @Column({
        type: 'varchar',
        default: MaintenanceStatus.SCHEDULED
    })
    status!: MaintenanceStatus;

    @Column('text', { nullable: true })
    description?: string;

    @Column({ nullable: true })
    cost?: number;

    @Column({ nullable: true })
    performedBy?: string;

    @Column('text', { nullable: true })
    notes?: string;

    @CreateDateColumn()
    createdAt!: Date;

    @UpdateDateColumn()
    updatedAt!: Date;
}
