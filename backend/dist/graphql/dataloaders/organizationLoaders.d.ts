import DataLoader from 'dataloader';
import { Organization } from '../../models/Organization';
import { DataLoaderOptions } from './types';
export declare function createOrganizationByIdLoader(options?: DataLoaderOptions): DataLoader<string, Organization | null>;
export declare function createOrganizationsByUserIdLoader(options?: DataLoaderOptions): DataLoader<string, Organization[]>;
//# sourceMappingURL=organizationLoaders.d.ts.map