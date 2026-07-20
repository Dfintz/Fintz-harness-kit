import DataLoader from 'dataloader';
import { Ship } from '../../models/Ship';
import { DataLoaderOptions } from './types';
export declare function createShipByIdLoader(options?: DataLoaderOptions): DataLoader<string, Ship | null>;
export declare function createShipsByUserIdLoader(options?: DataLoaderOptions): DataLoader<string, Ship[]>;
export declare function createShipsByOrganizationIdLoader(options?: DataLoaderOptions): DataLoader<string, Ship[]>;
export declare function createShipsByFleetIdLoader(options?: DataLoaderOptions): DataLoader<string, Ship[]>;
//# sourceMappingURL=shipLoaders.d.ts.map