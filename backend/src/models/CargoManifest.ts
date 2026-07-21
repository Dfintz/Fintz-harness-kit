import { Entity, PrimaryColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

export interface CargoItem {
    itemName: string;
    quantity: number;
    unitValue?: number;
    totalValue?: number;
}

export enum ManifestStatus {
    LOADING = 'loading',
    IN_TRANSIT = 'in_transit',
    DELIVERED = 'delivered',
    CANCELLED = 'cancelled'
}

@Entity('cargo_manifests')
export class CargoManifest {
    @PrimaryColumn()
    id!: string;

    @Column()
    shipId!: string;

    @Column()
    ownerId!: string;

    @Column('simple-json', { default: '[]' })
    cargo!: CargoItem[];

    @Column({ nullable: true })
    origin?: string;

    @Column({ nullable: true })
    destination?: string;

    @Column({
        type: 'varchar',
        default: ManifestStatus.LOADING
    })
    status!: ManifestStatus;

    @Column({ default: false })
    sharedWithFleet!: boolean;

    @Column({ default: false })
    sharedWithAlliance!: boolean;

    @Column({ nullable: true })
    departureDate?: Date;

    @Column({ nullable: true })
    arrivalDate?: Date;

    @Column('text', { nullable: true })
    notes?: string;

    @CreateDateColumn()
    createdAt!: Date;

    @UpdateDateColumn()
    updatedAt!: Date;
}
