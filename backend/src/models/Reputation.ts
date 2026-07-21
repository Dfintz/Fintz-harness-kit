import { Entity, PrimaryColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

export enum ReputationCategory {
    COMBAT = 'combat',
    TRADING = 'trading',
    MINING = 'mining',
    EXPLORATION = 'exploration',
    RELIABILITY = 'reliability',
    LEADERSHIP = 'leadership'
}

export interface ReputationScore {
    category: ReputationCategory;
    score: number;
    lastUpdated: Date;
}

export interface ReputationModifier {
    reason: string;
    amount: number;
    category: ReputationCategory;
    timestamp: Date;
    modifiedBy?: string;
}

@Entity('reputation')
export class Reputation {
    @PrimaryColumn()
    id!: string;

    @Index()
    @Column()
    userId!: string;

    @Column('simple-json', { default: '[]' })
    scores!: ReputationScore[];

    @Index()
    @Column({ default: 0 })
    overallScore!: number;

    @Column('simple-json', { default: '[]' })
    history!: ReputationModifier[];

    @UpdateDateColumn()
    lastUpdated!: Date;

    @CreateDateColumn()
    createdAt!: Date;
}
