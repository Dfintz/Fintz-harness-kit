import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';

/**
 * RSI Citizen Organization Affiliation
 *
 * Stores a citizen's organization affiliations as fetched from their
 * RSI profile page. Used for member intelligence — understanding which
 * other organizations a citizen belongs to.
 *
 * Citizen-scoped (not org-scoped): tracks ALL orgs for a given handle,
 * independent of which org is querying.
 */
@Entity('rsi_citizen_orgs')
@Unique('UQ_rsi_citizen_orgs_handle_sid', ['citizenHandle', 'organizationSid'])
@Index('IDX_rsi_citizen_orgs_handle', ['citizenHandle'])
@Index('IDX_rsi_citizen_orgs_org_sid', ['organizationSid'])
@Index('IDX_rsi_citizen_orgs_fetched_at', ['lastFetchedAt'])
export class RsiCitizenOrg {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** RSI handle of the citizen */
  @Column({ type: 'varchar', length: 100 })
  citizenHandle!: string;

  /** RSI organization Spectrum ID */
  @Column({ type: 'varchar', length: 50 })
  organizationSid!: string;

  /** RSI organization name */
  @Column({ type: 'varchar', length: 200 })
  organizationName!: string;

  /** Citizen's rank within this organization */
  @Column({ type: 'varchar', length: 50, nullable: true })
  rank?: string;

  /** Star rank (1-5) */
  @Column({ type: 'int', nullable: true })
  stars?: number;

  /** Whether this is the citizen's main organization */
  @Column({ default: false })
  isMain!: boolean;

  /** Whether this is an affiliate membership */
  @Column({ default: false })
  isAffiliate!: boolean;

  /** When this data was last fetched from RSI */
  @Column({ type: 'timestamp' })
  lastFetchedAt!: Date;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
