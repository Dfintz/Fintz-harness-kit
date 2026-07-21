import { Column, CreateDateColumn, Entity, Index, PrimaryColumn, UpdateDateColumn } from 'typeorm';

export enum LoanStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  ACTIVE = 'active',
  RETURNED = 'returned',
  DECLINED = 'declined',
  OVERDUE = 'overdue',
}

@Entity('ship_loans')
export class ShipLoan {
  @PrimaryColumn()
  id!: string;

  @Column()
  shipId!: string;

  @Column({ nullable: true })
  shipName?: string;

  @Index()
  @Column()
  lenderId!: string;

  @Index()
  @Column()
  borrowerId!: string;

  @Index()
  @Column({ nullable: true })
  organizationId?: string;

  @Index()
  @Column({ nullable: true })
  activityId?: string;

  @Column({ nullable: true })
  activityName?: string;

  @Column({ type: 'varchar', nullable: true })
  scope?: string; // 'organization' | 'alliance'

  @Column('text', { nullable: true })
  purpose?: string;

  @Column()
  requestDate!: Date;

  @Column({ nullable: true })
  approvedDate?: Date;

  @Index()
  @Column()
  startDate!: Date;

  @Index()
  @Column()
  expectedReturnDate!: Date;

  @Column({ nullable: true })
  actualReturnDate?: Date;

  @Index()
  @Column({
    type: 'varchar',
    default: LoanStatus.PENDING,
  })
  status!: LoanStatus;

  @Column('text', { nullable: true })
  terms?: string;

  @Column('text', { nullable: true })
  notes?: string;

  @Column({ default: false })
  insuranceRequired!: boolean;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
