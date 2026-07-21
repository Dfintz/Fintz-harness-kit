import { Entity, PrimaryColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

export enum TournamentStatus {
    REGISTRATION = 'registration',
    IN_PROGRESS = 'in_progress',
    COMPLETED = 'completed',
    CANCELLED = 'cancelled'
}

export enum MatchStatus {
    PENDING = 'pending',
    IN_PROGRESS = 'in_progress',
    COMPLETED = 'completed'
}

export interface TournamentParticipant {
    userId: string;
    teamName?: string;
    registeredAt: Date;
    seed?: number;
}

export interface Match {
    matchId: string;
    round: number;
    participant1Id?: string;
    participant2Id?: string;
    winnerId?: string;
    score?: string;
    status: MatchStatus;
    scheduledDate?: Date;
    completedAt?: Date;
}

@Entity('tournaments')
export class Tournament {
    @PrimaryColumn()
    id!: string;

    @Column()
    name!: string;

    @Column('text')
    description!: string;

    @Index()
    @Column()
    organizerId!: string;

    @Index()
    @Column()
    startDate!: Date;

    @Column({ nullable: true })
    endDate?: Date;

    @Index()
    @Column({
        type: 'varchar',
        default: TournamentStatus.REGISTRATION
    })
    status!: TournamentStatus;

    @Column({ default: 8 })
    maxParticipants!: number;

    @Column('simple-json', { default: '[]' })
    participants!: TournamentParticipant[];

    @Column('simple-json', { default: '[]' })
    matches!: Match[];

    @Column({ nullable: true })
    prizePool?: string;

    @Column({ nullable: true })
    rules?: string;

    @CreateDateColumn()
    createdAt!: Date;

    @UpdateDateColumn()
    updatedAt!: Date;
}
