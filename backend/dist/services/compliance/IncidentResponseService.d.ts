import { DataBreachNotification, IncidentStatus } from '../../models/DataBreachNotification';
import { NotificationService } from '../communication/notifications/NotificationService';
export interface BreachReport {
    title: string;
    description: string;
    severity: 'critical' | 'high' | 'medium' | 'low';
    affectedUsers: string[];
    affectedDataTypes: string[];
}
export declare class IncidentResponseService {
    private readonly breachRepository;
    private readonly userRepository;
    private notificationService?;
    private readonly appUrl;
    private readonly securityEmail;
    private readonly legalEmail;
    constructor(notificationService?: NotificationService);
    reportBreach(incidentData: BreachReport): Promise<DataBreachNotification>;
    notifyAffectedUsers(incident: DataBreachNotification): Promise<void>;
    generateBreachReport(incident: DataBreachNotification): Promise<string>;
    getById(id: string): Promise<DataBreachNotification | null>;
    listIncidents(): Promise<DataBreachNotification[]>;
    updateStatus(id: string, status: IncidentStatus): Promise<DataBreachNotification>;
    addRemediationStep(id: string, step: string): Promise<DataBreachNotification>;
    addRecommendation(id: string, recommendation: string): Promise<DataBreachNotification>;
    private getNotificationSubject;
    private getNotificationBody;
    private assessRiskLevel;
    private assessPotentialImpact;
    private notifyAdmins;
}
//# sourceMappingURL=IncidentResponseService.d.ts.map