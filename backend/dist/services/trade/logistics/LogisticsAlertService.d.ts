import { AlertFilterOptions, CreateAlertDto, LogisticsAlert, UpdateAlertDto } from '../../../models/LogisticsAlert';
export interface RestockRecommendation {
    itemId: string;
    itemName: string;
    category: string;
    currentQuantity: number;
    predictedDaysUntilStockout: number;
    recommendedRestockDate: Date;
    recommendedOrderQuantity: number;
    confidenceLevel: 'high' | 'medium' | 'low';
    reasoning: string;
    priceEstimate?: number;
    suggestedSupplier?: string;
}
export declare class LogisticsAlertService {
    private alertRepository;
    private inventoryRepository;
    checkInventoryAndGenerateAlerts(fleetId?: string): Promise<LogisticsAlert[]>;
    private calculateStockStatus;
    private generateAlertForItem;
    private generateRestockDueAlert;
    private generateConsumptionSpikeAlert;
    createAlert(dto: CreateAlertDto): Promise<LogisticsAlert>;
    getAlerts(filters: AlertFilterOptions): Promise<LogisticsAlert[]>;
    getAlertById(id: string): Promise<LogisticsAlert | null>;
    updateAlert(id: string, dto: UpdateAlertDto): Promise<LogisticsAlert>;
    acknowledgeAlert(id: string, userId: string): Promise<LogisticsAlert>;
    resolveAlert(id: string, userId: string, notes?: string): Promise<LogisticsAlert>;
    dismissAlert(id: string): Promise<LogisticsAlert>;
    deleteAlert(id: string): Promise<void>;
    autoResolveAlerts(): Promise<number>;
    getAlertStatistics(fleetId: string): Promise<{
        total: number;
        active: number;
        acknowledged: number;
        resolved: number;
        dismissed: number;
        bySeverity: Record<string, number>;
        byType: Record<string, number>;
    }>;
    private getAlertTypeForStatus;
    private getSeverityForStatus;
    private getThresholdForStatus;
    private getAlertTitle;
    private getAlertMessage;
    private getRecipientsForItem;
    getPredictiveRestockRecommendations(organizationId: string, fleetId?: string): Promise<RestockRecommendation[]>;
    private calculateRestockRecommendation;
    getRestockSchedule(organizationId: string, days?: number): Promise<Map<string, RestockRecommendation[]>>;
    getConsumptionTrend(itemId: string, days?: number): Promise<{
        averageDaily: number;
        trend: 'increasing' | 'decreasing' | 'stable';
        peakUsageDays: string[];
        forecast: Array<{
            date: string;
            predictedStock: number;
        }>;
    }>;
}
//# sourceMappingURL=LogisticsAlertService.d.ts.map