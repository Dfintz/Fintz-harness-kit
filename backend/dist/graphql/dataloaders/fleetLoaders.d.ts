import DataLoader from 'dataloader';
import { Fleet } from '../../models/Fleet';
import { DataLoaderOptions } from './types';
export declare function createFleetByIdLoader(options?: DataLoaderOptions): DataLoader<string, Fleet | null>;
export declare function createFleetsByOrganizationIdLoader(options?: DataLoaderOptions): DataLoader<string, Fleet[]>;
export declare function createFleetsByLeaderIdLoader(options?: DataLoaderOptions): DataLoader<string, Fleet[]>;
//# sourceMappingURL=fleetLoaders.d.ts.map