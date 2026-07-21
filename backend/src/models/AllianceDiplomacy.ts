import { Entity, PrimaryColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

export enum DiplomacyStatus {
    PROPOSED = 'proposed',
    ACTIVE = 'active',
    SUSPENDED = 'suspended',
    TERMINATED = 'terminated'
}

export enum AllianceType {
    TRADE = 'trade',
    MILITARY = 'military',
    MUTUAL_DEFENSE = 'mutual_defense',
    NON_AGGRESSION = 'non_aggression',
    FULL_ALLIANCE = 'full_alliance'
}

export interface DiplomaticTerm {
    term: string;
    description: string;
}

export interface DiplomaticIncident {
    incidentId: string;
    description: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    reportedBy: string;
    timestamp: Date;
    resolved: boolean;
}

@Entity('alliance_diplomacy')
export class AllianceDiplomacy {
    @PrimaryColumn()
    id!: string;

    @Column()
    orgId1!: string;

    @Column()
    orgId2!: string;

    @Column({
        type: 'varchar'
    })
    allianceType!: AllianceType;

    @Column({
        type: 'varchar',
        default: DiplomacyStatus.PROPOSED
    })
    status!: DiplomacyStatus;

    @Column()
    proposedBy!: string;

    @Column({ nullable: true })
    approvedBy?: string;

    @Column('simple-json', { default: '[]' })
    terms!: DiplomaticTerm[];

    @Column('simple-json', { default: '[]' })
    incidents!: DiplomaticIncident[];

    @Column({ nullable: true })
    startDate?: Date;

    @Column({ nullable: true })
    endDate?: Date;

    @Column('text', { nullable: true })
    notes?: string;

    @CreateDateColumn()
    createdAt!: Date;

    @UpdateDateColumn()
    updatedAt!: Date;
}
