import DataLoader from 'dataloader';
import { Activity } from '../../models/Activity';
import { Fleet } from '../../models/Fleet';
import { Organization } from '../../models/Organization';
import { Ship } from '../../models/Ship';
import { User } from '../../models/User';
export interface DataLoaders {
    userById: DataLoader<string, User | null>;
    organizationById: DataLoader<string, Organization | null>;
    fleetById: DataLoader<string, Fleet | null>;
    shipById: DataLoader<string, Ship | null>;
    activityById: DataLoader<string, Activity | null>;
    usersByOrganizationId: DataLoader<string, User[]>;
    organizationsByUserId: DataLoader<string, Organization[]>;
    fleetsByOrganizationId: DataLoader<string, Fleet[]>;
    fleetsByLeaderId: DataLoader<string, Fleet[]>;
    shipsByUserId: DataLoader<string, Ship[]>;
    shipsByOrganizationId: DataLoader<string, Ship[]>;
    shipsByFleetId: DataLoader<string, Ship[]>;
    activitiesByOrganizationId: DataLoader<string, Activity[]>;
    activitiesByUserId: DataLoader<string, Activity[]>;
}
export interface DataLoaderOptions {
    cache?: boolean;
    maxBatchSize?: number;
    batch?: boolean;
}
export declare const DEFAULT_DATALOADER_OPTIONS: DataLoaderOptions;
//# sourceMappingURL=types.d.ts.map