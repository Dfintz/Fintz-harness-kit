import DataLoader from 'dataloader';
import { Activity } from '../../models/Activity';
import { DataLoaderOptions } from './types';
export declare function createActivityByIdLoader(options?: DataLoaderOptions): DataLoader<string, Activity | null>;
export declare function createActivitiesByOrganizationIdLoader(options?: DataLoaderOptions): DataLoader<string, Activity[]>;
export declare function createActivitiesByUserIdLoader(options?: DataLoaderOptions): DataLoader<string, Activity[]>;
//# sourceMappingURL=activityLoaders.d.ts.map