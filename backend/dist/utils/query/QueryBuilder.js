"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrganizationQueryBuilder = exports.ActivityQueryBuilder = exports.ShipQueryBuilder = exports.FleetQueryBuilder = exports.BaseQueryBuilder = void 0;
class BaseQueryBuilder {
    repository;
    qb;
    alias;
    constructor(repository, alias) {
        this.repository = repository;
        this.alias = alias;
        this.qb = repository.createQueryBuilder(alias);
    }
    forOrganization(organizationId) {
        this.qb.andWhere(`${this.alias}.organizationId = :organizationId`, { organizationId });
        return this;
    }
    orderBy(field, direction = 'ASC') {
        this.qb.orderBy(`${this.alias}.${field}`, direction);
        return this;
    }
    addOrderBy(field, direction = 'ASC') {
        this.qb.addOrderBy(`${this.alias}.${field}`, direction);
        return this;
    }
    paginate(page, limit) {
        const offset = (page - 1) * limit;
        this.qb.skip(offset).take(limit);
        return this;
    }
    limit(limit) {
        this.qb.take(limit);
        return this;
    }
    offset(offset) {
        this.qb.skip(offset);
        return this;
    }
    whereEquals(field, value) {
        this.qb.andWhere(`${this.alias}.${field} = :${field}`, { [field]: value });
        return this;
    }
    whereLike(field, pattern) {
        this.qb.andWhere(`${this.alias}.${field} ILIKE :${field}Pattern`, {
            [`${field}Pattern`]: `%${pattern}%`,
        });
        return this;
    }
    whereIn(field, values) {
        if (values.length > 0) {
            this.qb.andWhere(`${this.alias}.${field} IN (:...${field}Values)`, {
                [`${field}Values`]: values,
            });
        }
        return this;
    }
    whereDateRange(field, from, to) {
        if (from) {
            this.qb.andWhere(`${this.alias}.${field} >= :${field}From`, {
                [`${field}From`]: from,
            });
        }
        if (to) {
            this.qb.andWhere(`${this.alias}.${field} <= :${field}To`, {
                [`${field}To`]: to,
            });
        }
        return this;
    }
    cache(milliseconds, id) {
        this.qb.cache(id ?? true, milliseconds);
        return this;
    }
    getSql() {
        return this.qb.getSql();
    }
    getParameters() {
        return this.qb.getParameters();
    }
    async getMany() {
        return this.qb.getMany();
    }
    async getManyAndCount() {
        return this.qb.getManyAndCount();
    }
    async getOne() {
        return this.qb.getOne();
    }
    async getPaginated(options) {
        this.paginate(options.page, options.limit);
        const [data, total] = await this.getManyAndCount();
        const totalPages = Math.ceil(total / options.limit);
        return {
            data,
            total,
            page: options.page,
            limit: options.limit,
            totalPages,
            hasNext: options.page < totalPages,
            hasPrev: options.page > 1,
        };
    }
    async getCount() {
        return this.qb.getCount();
    }
    async exists() {
        const count = await this.qb.getCount();
        return count > 0;
    }
}
exports.BaseQueryBuilder = BaseQueryBuilder;
class FleetQueryBuilder extends BaseQueryBuilder {
    constructor(repository) {
        super(repository, 'fleet');
    }
    withShips() {
        this.qb.leftJoinAndSelect('fleet.ships', 'ship');
        return this;
    }
    withMembers() {
        this.qb.leftJoinAndSelect('fleet.members', 'member');
        return this;
    }
    withAllRelations() {
        return this.withShips().withMembers();
    }
    searchByName(name) {
        return this.whereLike('name', name);
    }
    includeShared(organizationId) {
        this.qb.orWhere(`:orgId = ANY(fleet.sharedWith)`, { orgId: organizationId });
        return this;
    }
    createdBetween(from, to) {
        return this.whereDateRange('createdAt', from, to);
    }
}
exports.FleetQueryBuilder = FleetQueryBuilder;
class ShipQueryBuilder extends BaseQueryBuilder {
    constructor(repository) {
        super(repository, 'ship');
    }
    withOwner() {
        this.qb.leftJoinAndSelect('ship.owner', 'owner');
        return this;
    }
    withFleet() {
        this.qb.leftJoinAndSelect('ship.fleet', 'fleet');
        return this;
    }
    forFleet(fleetId) {
        return this.whereEquals('fleetId', fleetId);
    }
    forUser(userId) {
        return this.whereEquals('userId', userId);
    }
    byManufacturer(manufacturer) {
        return this.whereLike('manufacturer', manufacturer);
    }
    withStatus(status) {
        return this.whereEquals('status', status);
    }
    withStatuses(statuses) {
        return this.whereIn('status', statuses);
    }
}
exports.ShipQueryBuilder = ShipQueryBuilder;
class ActivityQueryBuilder extends BaseQueryBuilder {
    constructor(repository) {
        super(repository, 'activity');
    }
    withParticipants() {
        this.qb.leftJoinAndSelect('activity.participants', 'participant');
        return this;
    }
    ofType(type) {
        return this.whereEquals('type', type);
    }
    ofTypes(types) {
        return this.whereIn('type', types);
    }
    withStatus(status) {
        return this.whereEquals('status', status);
    }
    upcoming() {
        this.qb.andWhere('activity.startTime > :now', { now: new Date() });
        return this.orderBy('startTime', 'ASC');
    }
    past() {
        this.qb.andWhere('activity.endTime < :now', { now: new Date() });
        return this.orderBy('startTime', 'DESC');
    }
    inDateRange(from, to) {
        this.qb.andWhere('activity.startTime >= :from', { from });
        this.qb.andWhere('activity.startTime <= :to', { to });
        return this;
    }
}
exports.ActivityQueryBuilder = ActivityQueryBuilder;
class OrganizationQueryBuilder extends BaseQueryBuilder {
    constructor(repository) {
        super(repository, 'organization');
    }
    withMembers() {
        return this;
    }
    withFleets() {
        this.qb.leftJoinAndSelect('organization.fleets', 'fleet');
        return this;
    }
    searchByName(name) {
        return this.whereLike('name', name);
    }
}
exports.OrganizationQueryBuilder = OrganizationQueryBuilder;
//# sourceMappingURL=QueryBuilder.js.map