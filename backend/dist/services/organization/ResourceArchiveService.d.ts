import { Fleet } from '../../models/Fleet';
export declare class ResourceArchiveService {
    private static instance;
    private fleetRepository;
    private constructor();
    static getInstance(): ResourceArchiveService;
    archiveFleet(fleetId: string, organizationId: string, archivedBy: string, reason?: string): Promise<Fleet>;
    restoreFleet(fleetId: string, organizationId: string, restoredBy: string): Promise<Fleet>;
    permanentlyDeleteFleet(fleetId: string, organizationId: string, deletedBy: string, minimumArchiveDays?: number): Promise<void>;
    getArchivedFleets(organizationId: string): Promise<Fleet[]>;
    getArchivedFleetById(fleetId: string, organizationId: string): Promise<Fleet | null>;
    getArchivedFleetCount(organizationId: string): Promise<number>;
}
//# sourceMappingURL=ResourceArchiveService.d.ts.map