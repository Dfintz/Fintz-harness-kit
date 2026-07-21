import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/**
 * Represents a completed LFG session with all participants and outcome
 */
@Entity('lfg_group_history')
export class LFGGroupHistory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index()
  lfgPostId: string;

  @Column()
  @Index()
  activity: string; // LFGActivity type

  @Column()
  description: string;

  @Column()
  @Index()
  creatorId: string;

  @Column()
  creatorName: string;

  @Column('simple-array')
  participantIds: string[];

  @Column('int')
  participantCount: number;

  @Column()
  @Index()
  guildId: string;

  @Column()
  channelId: string;

  @Column({ default: false })
  wasSuccessful: boolean;

  @Column({ nullable: true })
  durationMinutes?: number;

  @Column('simple-json', { nullable: true })
  completionNotes?: {
    submittedBy: string;
    note: string;
    timestamp: Date;
  };

  @CreateDateColumn()
  @Index()
  completedAt: Date;

  @Column()
  @Index()
  userId: string; // Denormalized for quick user queries

  /**
   * Get success rate score (0-100)
   */
  getSuccessScore(): number {
    return this.wasSuccessful ? 100 : 0;
  }

  /**
   * Get participation summary
   */
  getSummary(): {
    activity: string;
    participants: number;
    successful: boolean;
    duration?: number;
  } {
    return {
      activity: this.activity,
      participants: this.participantCount,
      successful: this.wasSuccessful,
      duration: this.durationMinutes,
    };
  }
}
