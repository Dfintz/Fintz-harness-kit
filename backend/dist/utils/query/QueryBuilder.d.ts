import { ObjectLiteral, Repository, SelectQueryBuilder } from 'typeorm';
export type SortDirection = 'ASC' | 'DESC';
export interface PaginationOptions {
    page: number;
    limit: number;
}
export interface PaginatedResult<T> {
    data: T[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
}
export declare abstract class BaseQueryBuilder<T extends ObjectLiteral> {
    protected readonly repository: Repository<T>;
    protected qb: SelectQueryBuilder<T>;
    protected readonly alias: string;
    constructor(repository: Repository<T>, alias: string);
    forOrganization(organizationId: string): this;
    orderBy(field: string, direction?: SortDirection): this;
    addOrderBy(field: string, direction?: SortDirection): this;
    paginate(page: number, limit: number): this;
    limit(limit: number): this;
    offset(offset: number): this;
    whereEquals(field: string, value: unknown): this;
    whereLike(field: string, pattern: string): this;
    whereIn(field: string, values: unknown[]): this;
    whereDateRange(field: string, from?: Date, to?: Date): this;
    cache(milliseconds: number, id?: string): this;
    getSql(): string;
    getParameters(): Record<string, unknown>;
    getMany(): Promise<T[]>;
    getManyAndCount(): Promise<[T[], number]>;
    getOne(): Promise<T | null>;
    getPaginated(options: PaginationOptions): Promise<PaginatedResult<T>>;
    getCount(): Promise<number>;
    exists(): Promise<boolean>;
}
export declare class FleetQueryBuilder extends BaseQueryBuilder<{
    id: string;
    name: string;
    organizationId: string;
    members?: unknown[];
    ships?: unknown[];
    sharedWith?: string[];
    createdAt?: Date;
    updatedAt?: Date;
}> {
    constructor(repository: Repository<ObjectLiteral>);
    withShips(): this;
    withMembers(): this;
    withAllRelations(): this;
    searchByName(name: string): this;
    includeShared(organizationId: string): this;
    createdBetween(from?: Date, to?: Date): this;
}
export declare class ShipQueryBuilder extends BaseQueryBuilder<{
    id: string;
    name: string;
    organizationId: string;
    fleetId?: string;
    userId?: string;
    manufacturer?: string;
    status?: string;
}> {
    constructor(repository: Repository<ObjectLiteral>);
    withOwner(): this;
    withFleet(): this;
    forFleet(fleetId: string): this;
    forUser(userId: string): this;
    byManufacturer(manufacturer: string): this;
    withStatus(status: string): this;
    withStatuses(statuses: string[]): this;
}
export declare class ActivityQueryBuilder extends BaseQueryBuilder<{
    id: string;
    name: string;
    organizationId: string;
    type?: string;
    status?: string;
    startTime?: Date;
    endTime?: Date;
}> {
    constructor(repository: Repository<ObjectLiteral>);
    withParticipants(): this;
    ofType(type: string): this;
    ofTypes(types: string[]): this;
    withStatus(status: string): this;
    upcoming(): this;
    past(): this;
    inDateRange(from: Date, to: Date): this;
}
export declare class OrganizationQueryBuilder extends BaseQueryBuilder<{
    id: string;
    name: string;
    organizationId: string;
}> {
    constructor(repository: Repository<ObjectLiteral>);
    withMembers(): this;
    withFleets(): this;
    searchByName(name: string): this;
}
//# sourceMappingURL=QueryBuilder.d.ts.map