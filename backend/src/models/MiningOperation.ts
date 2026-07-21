import { Entity, PrimaryColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

export enum MiningOperationStatus {
    PLANNED = 'planned',
    IN_PROGRESS = 'in_progress',
    COMPLETED = 'completed',
    CANCELLED = 'cancelled'
}

export interface MiningCrew {
    userId: string;
    role: 'miner' | 'escort' | 'hauler' | 'refiner';
    shipId?: string;
}

export interface ResourceYield {
    resourceType: string;
    quantity: number;
    value: number;
}

@Entity('mining_operations')
export class MiningOperation {
    @PrimaryColumn()
    id!: string;

    @Column()
    name!: string;

    @Column('text')
    description!: string;

    @Column()
    location!: string;

    @Index()
    @Column()
    coordinatorId!: string;

    @Index()
    @Column()
    scheduledDate!: Date;

    @Column({ nullable: true })
    completedDate?: Date;

    @Index()
    @Column({
        type: 'varchar',
        default: MiningOperationStatus.PLANNED
    })
    status!: MiningOperationStatus;

    @Column('simple-json', { default: '[]' })
    crew!: MiningCrew[];

    @Column('simple-json', { default: '[]' })
    resourcesFound!: ResourceYield[];

    @Column({ default: 0 })
    totalValue!: number;

    @Column({ nullable: true })
    notes?: string;

    @CreateDateColumn()
    createdAt!: Date;

    @UpdateDateColumn()
    updatedAt!: Date;
}
