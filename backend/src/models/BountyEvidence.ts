import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    ManyToOne,
    JoinColumn,
    Index
} from 'typeorm';

import { BountyClaim } from './BountyClaim';

/**
 * Evidence Types
 */
export enum EvidenceType {
    SCREENSHOT = 'screenshot',
    VIDEO = 'video',
    TEXT = 'text',
    LINK = 'link',
    FILE = 'file'
}

/**
 * Bounty Evidence Entity
 * 
 * Stores evidence submitted by hunters for their bounty claims.
 * Supports various evidence types including screenshots, videos, and text descriptions.
 */
@Entity('bounty_evidence')
@Index(['claimId'])
export class BountyEvidence {
    @PrimaryGeneratedColumn('uuid')
    id!: string;

    @Column({ type: 'uuid' })
    claimId!: string;

    @ManyToOne(() => BountyClaim, claim => claim.evidence, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'claimId' })
    claim?: BountyClaim;

    @Column({
        type: 'varchar',
        length: 20
    })
    evidenceType!: EvidenceType;

    @Column({ type: 'text', nullable: true })
    content?: string;

    @Column({ length: 500, nullable: true })
    fileUrl?: string;

    @Column({ length: 255, nullable: true })
    fileName?: string;

    @Column({ type: 'integer', nullable: true })
    fileSize?: number;

    @Column({ length: 100, nullable: true })
    mimeType?: string;

    @Column({ type: 'uuid' })
    submittedBy!: string;

    @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
    submittedAt!: Date;

    @CreateDateColumn()
    createdAt!: Date;

    // Computed properties
    get isFile(): boolean {
        return this.evidenceType === EvidenceType.SCREENSHOT ||
               this.evidenceType === EvidenceType.VIDEO ||
               this.evidenceType === EvidenceType.FILE;
    }

    get isText(): boolean {
        return this.evidenceType === EvidenceType.TEXT;
    }

    get isLink(): boolean {
        return this.evidenceType === EvidenceType.LINK;
    }

    get hasFile(): boolean {
        return !!this.fileUrl;
    }
}
