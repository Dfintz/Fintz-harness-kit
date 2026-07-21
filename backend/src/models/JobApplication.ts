import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { PublicJobListing } from './PublicJobListing';
import { User } from './User';

/**
 * Application status lifecycle:
 *   pending → approved | rejected | waitlisted
 *   waitlisted → approved | rejected | withdrawn
 *   approved (terminal)
 *   rejected (terminal)
 *   withdrawn (terminal — applicant-initiated)
 */
export enum JobApplicationStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  WAITLISTED = 'waitlisted',
  WITHDRAWN = 'withdrawn',
}

/**
 * How the applicant wants to join the operation.
 *
 *  - crew      — fill a specific crew role on a ship
 *  - passenger  — ride as a non-crew passenger (marine, VIP, etc.)
 *  - vehicle    — bring your own ship / vehicle to the operation
 *  - general    — generic join (for uncapped listings with no breakdown)
 */
export enum JobApplicationType {
  CREW = 'crew',
  PASSENGER = 'passenger',
  VEHICLE = 'vehicle',
  GENERAL = 'general',
}

/**
 * JobApplication entity — tracks interest in a PublicJobListing.
 *
 * Covers the full flow:
 *  1. User applies  (status=pending, or auto-approved if listing allows)
 *  2. Owner approves / rejects / waitlists
 *  3. Approved applicants get their slot filled automatically
 */
@Entity('job_applications')
export class JobApplication {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  // ── relationships ──────────────────────────────────────────────

  @Column()
  @Index()
  jobListingId!: string;

  @ManyToOne(() => PublicJobListing, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'jobListingId' })
  jobListing?: PublicJobListing;

  @Column()
  @Index()
  applicantUserId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'applicantUserId' })
  applicant?: User;

  // ── application details ────────────────────────────────────────

  @Column({
    type: 'enum',
    enum: JobApplicationType,
    default: JobApplicationType.GENERAL,
  })
  @Index()
  applicationType!: JobApplicationType;

  @Column({
    type: 'enum',
    enum: JobApplicationStatus,
    default: JobApplicationStatus.PENDING,
  })
  @Index()
  status!: JobApplicationStatus;

  /** Display name of the applicant (denormalised for fast reads) */
  @Column({ type: 'varchar', length: 255 })
  applicantDisplayName!: string;

  /** Optional message from the applicant */
  @Column({ type: 'text', nullable: true })
  message?: string;

  // ── crew-specific fields ───────────────────────────────────────

  /** Index of the ship in shipCrewBreakdown the applicant wants to crew */
  @Column({ type: 'integer', nullable: true })
  shipIndex?: number;

  /** Index of the role within that ship's roles array */
  @Column({ type: 'integer', nullable: true })
  roleIndex?: number;

  /** Friendly name of the role being applied for (e.g. "Gunner") */
  @Column({ type: 'varchar', length: 100, nullable: true })
  roleName?: string;

  /** Friendly name of the ship being applied to (e.g. "Anvil Carrack") */
  @Column({ type: 'varchar', length: 255, nullable: true })
  shipName?: string;

  // ── passenger-specific fields ──────────────────────────────────

  /** Index of the ship the applicant wants to ride on (passenger) */
  @Column({ type: 'integer', nullable: true })
  passengerShipIndex?: number;

  /** Name of the passenger role (e.g. "Marine") */
  @Column({ type: 'varchar', length: 100, nullable: true })
  passengerRole?: string;

  // ── vehicle-specific fields ────────────────────────────────────

  /** Name of the vehicle/ship the applicant is bringing */
  @Column({ type: 'varchar', length: 255, nullable: true })
  vehicleName?: string;

  // ── application form responses ─────────────────────────────────

  /** Structured form responses for org application questions (questionId → answer) */
  @Column({ type: 'jsonb', nullable: true })
  formResponses?: Record<string, string>;

  // ── review fields ──────────────────────────────────────────────

  /** User who reviewed (approved / rejected / waitlisted) the application */
  @Column({ nullable: true })
  reviewedBy?: string;

  /** Optional reason for rejection or waitlist decision */
  @Column({ type: 'text', nullable: true })
  reviewNote?: string;

  @Column({ type: 'timestamp', nullable: true })
  reviewedAt?: Date;

  // ── waitlist ───────────────────────────────────────────────────

  /** Position in the waitlist (1-based, null if not waitlisted) */
  @Column({ type: 'integer', nullable: true })
  waitlistPosition?: number;

  // ── timestamps ─────────────────────────────────────────────────

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
