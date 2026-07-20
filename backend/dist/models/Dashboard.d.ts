import { DashboardWidget } from './DashboardWidget';
import { Organization } from './Organization';
import { User } from './User';
export declare enum DashboardType {
    CUSTOM = "custom",
    FLEET = "fleet",
    ANALYTICS = "analytics",
    OPERATIONS = "operations"
}
export declare enum DashboardLayout {
    GRID = "grid",
    LIST = "list",
    FREEFORM = "freeform"
}
export declare class Dashboard {
    id: string;
    organizationId: string;
    organization?: Organization;
    name: string;
    description?: string;
    type: string;
    layout: string;
    createdBy: string;
    creator?: User;
    isDefault: boolean;
    sharedWithUsers?: string[];
    widgets?: DashboardWidget[];
    createdAt: Date;
    updatedAt: Date;
}
//# sourceMappingURL=Dashboard.d.ts.map