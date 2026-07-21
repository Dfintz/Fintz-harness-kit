import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('ship_loadouts')
export class ShipLoadout {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  name!: string;

  @Index()
  @Column()
  ownerId!: string;

  @Column({ nullable: true })
  shipId?: string;

  @Column()
  shipName!: string;

  @Column('simple-json')
  components!: Array<{
    slot: string;
    componentName: string;
    componentType: string;
    manufacturer?: string;
  }>;

  @Column('text', { nullable: true })
  description?: string;

  @Column({ nullable: true })
  erkulGamesUrl?: string;

  @Column({ nullable: true, length: 500 })
  spViewerUrl?: string;

  @Column('simple-json', { nullable: true })
  statistics?: {
    dps?: number;
    totalHp?: number;
    cargoCapacity?: number;
    quantumSpeed?: number;
    [key: string]: unknown;
  };

  @Column({ default: 1 })
  version!: number;

  @Column({ nullable: true })
  parentLoadoutId?: string;

  @Column({ default: true })
  isLatestVersion!: boolean;

  @Column({ default: false })
  sharedWithFleet!: boolean;

  @Column({ default: false })
  sharedWithOrg!: boolean;

  @Column({ default: false })
  sharedWithAlliance!: boolean;

  @Column('simple-array', { nullable: true, default: '' })
  sharedWithOrgs?: string[];

  @Column('simple-array', { nullable: true })
  sharedWithUsers?: string[];

  @Column('text', { nullable: true })
  notes?: string;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
