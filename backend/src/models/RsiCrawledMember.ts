import { Column, CreateDateColumn, Entity, Index, PrimaryColumn } from 'typeorm';

/**
 * Cached RSI Organization Member data from web crawling
 * Stores member information fetched directly from RSI website
 */
@Entity('rsi_crawled_members')
@Index(['organizationSid', 'handle'])
@Index(['lastCrawledAt'])
export class RsiCrawledMember {
  @PrimaryColumn()
  id!: string; // Composite: organizationSid:handle

  @Index()
  @Column()
  organizationSid!: string;

  @Index()
  @Column()
  handle!: string;

  @Column({ nullable: true })
  displayName?: string;

  @Column({ nullable: true })
  rank?: string; // Member rank in organization

  @Column({ default: 0 })
  stars!: number; // Star rank (1-5)

  @Column({ default: false })
  isMain!: boolean; // Is this their main org

  @Column({ default: false })
  isAffiliate!: boolean; // Is this an affiliate membership

  @Column({ default: false })
  isHidden!: boolean; // Is membership hidden

  @Column({ default: false })
  isRedacted!: boolean; // Is profile redacted/hidden

  @Column({ type: 'text', nullable: true })
  avatar?: string; // Avatar image URL

  @Column({ type: 'text', nullable: true })
  enlisted?: string; // Enlisted date

  @Column({ type: 'simple-json', nullable: true })
  roles?: string[]; // Organization roles (e.g., CEO, VP, CHRO)

  @CreateDateColumn()
  firstCrawledAt!: Date;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  lastCrawledAt!: Date;

  @Column({ type: 'text', nullable: true })
  crawlError?: string; // Last error message if crawl failed

  @Column({ default: false })
  crawlFailed!: boolean; // Whether the last crawl attempt failed
}
