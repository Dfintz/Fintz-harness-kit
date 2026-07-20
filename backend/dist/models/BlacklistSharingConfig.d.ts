import { TenantEntity } from './base/TenantEntity';
export declare class BlacklistSharingConfig extends TenantEntity {
    id: string;
    shareWarnings: boolean;
    shareTimeouts: boolean;
    shareKicks: boolean;
    shareBans: boolean;
    receiveAlerts: boolean;
    minAlertSeverity: number;
    alertChannelId?: string;
    autoShareWithAllies: boolean;
    autoShareMinSeverity: number;
    autoEnforceEnabled: boolean;
    autoEnforceTimeouts: boolean;
    autoEnforceKicks: boolean;
    createdAt: Date;
    updatedAt: Date;
    shouldShareIncidentType(incidentType: 'warning' | 'timeout' | 'long_timeout' | 'kick' | 'ban'): boolean;
    shouldAlert(severity: number): boolean;
    shouldAutoShare(severity: number): boolean;
    shouldAutoEnforce(incidentType: 'warning' | 'timeout' | 'long_timeout' | 'kick' | 'ban'): boolean;
    getSharingSummary(): {
        sharingEnabled: boolean;
        sharedTypes: string[];
        alertsEnabled: boolean;
        alertChannel: string | null;
    };
}
//# sourceMappingURL=BlacklistSharingConfig.d.ts.map