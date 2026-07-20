import DataLoader from 'dataloader';
import { User } from '../../models/User';
import { DataLoaderOptions } from './types';
export declare function createUserByIdLoader(options?: DataLoaderOptions): DataLoader<string, User | null>;
export declare function createUsersByOrganizationIdLoader(options?: DataLoaderOptions): DataLoader<string, User[]>;
//# sourceMappingURL=userLoaders.d.ts.map