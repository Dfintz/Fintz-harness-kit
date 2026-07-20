export interface CargoItem {
    itemName: string;
    quantity: number;
    unitValue?: number;
    totalValue?: number;
}
export declare enum ManifestStatus {
    LOADING = "loading",
    IN_TRANSIT = "in_transit",
    DELIVERED = "delivered",
    CANCELLED = "cancelled"
}
export declare class CargoManifest {
    id: string;
    shipId: string;
    ownerId: string;
    cargo: CargoItem[];
    origin?: string;
    destination?: string;
    status: ManifestStatus;
    sharedWithFleet: boolean;
    sharedWithAlliance: boolean;
    departureDate?: Date;
    arrivalDate?: Date;
    notes?: string;
    createdAt: Date;
    updatedAt: Date;
}
//# sourceMappingURL=CargoManifest.d.ts.map