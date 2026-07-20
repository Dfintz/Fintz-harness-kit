import { Activity } from '../../models/Activity';
import { Fleet } from '../../models/Fleet';
import { Organization } from '../../models/Organization';
import { Ship } from '../../models/Ship';
import { User } from '../../models/User';
import { DataLoaderOptions, DataLoaders } from './types';
export { DEFAULT_DATALOADER_OPTIONS } from './types';
export type { DataLoaderOptions, DataLoaders } from './types';
export declare function createDataLoaders(options?: DataLoaderOptions): DataLoaders;
export declare function createDataLoadersWithPriming(options?: DataLoaderOptions): {
    loaders: DataLoaders;
    prime: {
        users: (users: User[]) => void;
        organizations: (orgs: Organization[]) => void;
        fleets: (fleets: Fleet[]) => void;
        ships: (ships: Ship[]) => void;
        activities: (activities: Activity[]) => void;
    };
};
//# sourceMappingURL=index.d.ts.map