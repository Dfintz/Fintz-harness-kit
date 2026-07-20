import { CargoManifest, ManifestStatus } from '../../models/CargoManifest';
import { PaginatedResponse, PaginationOptions } from '../../utils/pagination';
export interface CreateManifestDto {
    shipId: string;
    ownerId?: string;
    cargo?: CargoManifest['cargo'];
    origin?: string;
    destination?: string;
    sharedWithFleet?: boolean;
    sharedWithAlliance?: boolean;
    notes?: string;
}
export declare class CargoManifestService {
    private readonly repository;
    private readonly shipRepository;
    constructor();
    private scopedManifestQuery;
    create(dto: CreateManifestDto, organizationId: string, ownerId: string): Promise<CargoManifest>;
    findAll(pagination: PaginationOptions, organizationId: string): Promise<PaginatedResponse<CargoManifest>>;
    findById(id: string, organizationId: string): Promise<CargoManifest>;
    addCargoItem(id: string, organizationId: string, item: {
        itemName: string;
        quantity: number;
        unitValue?: number;
    }): Promise<CargoManifest>;
    updateStatus(id: string, organizationId: string, status: ManifestStatus): Promise<CargoManifest>;
    updateSharing(id: string, organizationId: string, sharing: {
        sharedWithFleet?: boolean;
        sharedWithAlliance?: boolean;
    }): Promise<CargoManifest>;
}
//# sourceMappingURL=CargoManifestService.d.ts.map