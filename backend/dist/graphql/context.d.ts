import { Request, Response } from 'express';
import { container } from 'tsyringe';
import { DataLoaderContext } from '../utils/query/DataLoaderFactory';
import { DataLoaders } from './dataloaders';
export type { DataLoaders } from './dataloaders';
export interface User {
    id: string;
    username: string;
    email?: string;
    organizationIds?: string[];
}
export interface GraphQLContext {
    user: User | null;
    req?: Request;
    res?: Response;
    container: typeof container;
    loaders: DataLoaders;
    tenantLoaders: DataLoaderContext;
}
interface CreateContextOptions {
    req?: Request;
    res?: Response;
    token?: string;
}
export declare function createContext(options: CreateContextOptions): GraphQLContext;
//# sourceMappingURL=context.d.ts.map