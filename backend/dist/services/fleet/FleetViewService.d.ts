import { FleetViewExportOptions, FleetViewImportOptions, FleetViewImportResult, FleetViewSchema } from '../../types/fleetview';
export declare class FleetViewService {
    private shipRepository;
    exportToFleetView(options: FleetViewExportOptions): Promise<FleetViewSchema>;
    importFromFleetView(schema: FleetViewSchema, options: FleetViewImportOptions): Promise<FleetViewImportResult>;
    private shipToFleetView;
    private fleetViewToShip;
    private calculateStatistics;
    private generateShipId;
    validateSchema(schema: unknown): schema is FleetViewSchema;
}
//# sourceMappingURL=FleetViewService.d.ts.map