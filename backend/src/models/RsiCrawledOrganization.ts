import { Column, CreateDateColumn, Entity, Index, PrimaryColumn } from 'typeorm';

/**
 * Cached RSI Organization data from web crawling
 * Stores organization information fetched directly from RSI website
 */
@Entity('rsi_crawled_organizations')
@Index(['sid'])
@Index(['lastCrawledAt'])
export class RsiCrawledOrganization {
  @PrimaryColumn()
  sid!: string; // Organization SID (e.g., "TEST")

  @Column()
  name!: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ type: 'text', nullable: true })
  banner?: string; // Banner image URL

  @Column({ type: 'text', nullable: true })
  logo?: string; // Logo image URL

  @Column({ nullable: true })
  archetype?: string; // Organization type (e.g., "PMC", "Corporation")

  @Column({ nullable: true })
  commitment?: string; // Commitment level

  @Column({ nullable: true })
  roleplay?: string; // Roleplay preference

  @Column({ default: 0 })
  memberCount!: number;

  @Column({ default: 0 })
  affiliateCount!: number;

  @Column({ type: 'simple-json', nullable: true })
  focus?: {
    primary?: string;
    secondary?: string;
  };

  @Column({ type: 'text', nullable: true })
  recruiting?: string; // Recruiting status

  @Column({ type: 'text', nullable: true })
  language?: string; // Primary language

  @Column({ type: 'text', nullable: true })
  exclusive?: string; // Exclusive membership status

  @Column({ type: 'simple-json', nullable: true })
  links?: {
    website?: string;
    discord?: string;
    youtube?: string;
    twitch?: string;
  };

  @CreateDateColumn()
  firstCrawledAt!: Date;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  lastCrawledAt!: Date;

  @Column({ type: 'text', nullable: true })
  crawlError?: string; // Last error message if crawl failed

  @Column({ default: false })
  crawlFailed!: boolean; // Whether the last crawl attempt failed
}
