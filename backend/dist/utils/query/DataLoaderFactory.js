"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DataLoaderContext = exports.DataLoaderFactory = exports.DataLoader = void 0;
const typeorm_1 = require("typeorm");
class DataLoader {
    batchLoadFn;
    cache;
    queue;
    batchTimeout = null;
    options;
    constructor(batchLoadFn, options = {}) {
        this.batchLoadFn = batchLoadFn;
        this.options = {
            maxBatchSize: options.maxBatchSize ?? 100,
            cache: options.cache ?? true,
            batchDelay: options.batchDelay ?? 0,
        };
        this.cache = new Map();
        this.queue = [];
    }
    load(key) {
        if (this.options.cache) {
            const cachedPromise = this.cache.get(key);
            if (cachedPromise) {
                return cachedPromise;
            }
        }
        const promise = new Promise((resolve, reject) => {
            this.queue.push({ key, resolve, reject });
            this.scheduleBatch();
        });
        if (this.options.cache) {
            this.cache.set(key, promise);
        }
        return promise;
    }
    async loadMany(keys) {
        return Promise.all(keys.map(key => this.load(key)));
    }
    clear(key) {
        if (key === undefined) {
            this.cache.clear();
            return this;
        }
        this.cache.delete(key);
        return this;
    }
    prime(key, value) {
        if (this.options.cache && !this.cache.has(key)) {
            this.cache.set(key, Promise.resolve(value));
        }
        return this;
    }
    scheduleBatch() {
        if (this.batchTimeout !== null) {
            return;
        }
        if (this.options.batchDelay > 0) {
            this.batchTimeout = setTimeout(() => {
                void this.executeBatch();
            }, this.options.batchDelay);
        }
        else {
            this.batchTimeout = setImmediate(() => {
                void this.executeBatch();
            });
        }
    }
    async executeBatch() {
        this.batchTimeout = null;
        if (this.queue.length === 0) {
            return;
        }
        const batch = this.queue.splice(0, this.options.maxBatchSize);
        const keys = batch.map(item => item.key);
        try {
            const results = await this.batchLoadFn(keys);
            if (results.length !== keys.length) {
                throw new Error(`DataLoader batch function returned ${results.length} results for ${keys.length} keys`);
            }
            batch.forEach((item, index) => {
                item.resolve(results[index]);
            });
        }
        catch (error) {
            batch.forEach(item => {
                item.reject(error instanceof Error ? error : new Error(String(error)));
                if (this.options.cache) {
                    this.cache.delete(item.key);
                }
            });
        }
        if (this.queue.length > 0) {
            this.scheduleBatch();
        }
    }
}
exports.DataLoader = DataLoader;
class DataLoaderFactory {
    static createEntityLoader(repository, idField = 'id', additionalWhere = {}, options = {}) {
        return new DataLoader(async (ids) => {
            const entities = await repository.find({
                where: {
                    [idField]: (0, typeorm_1.In)(ids),
                    ...additionalWhere,
                },
            });
            const entityMap = new Map();
            entities.forEach(entity => {
                const idValue = entity[idField];
                if (idValue !== undefined && idValue !== null) {
                    entityMap.set(String(idValue), entity);
                }
            });
            return ids.map(id => entityMap.get(id));
        }, options);
    }
    static createRelationLoader(repository, foreignKey, additionalWhere = {}, options = {}) {
        return new DataLoader(async (parentIds) => {
            const entities = await repository.find({
                where: {
                    [foreignKey]: (0, typeorm_1.In)(parentIds),
                    ...additionalWhere,
                },
            });
            const entityGroups = new Map();
            parentIds.forEach(id => entityGroups.set(id, []));
            entities.forEach(entity => {
                const parentIdValue = entity[foreignKey];
                if (parentIdValue === undefined || parentIdValue === null) {
                    return;
                }
                const parentId = String(parentIdValue);
                const group = entityGroups.get(parentId);
                if (group) {
                    group.push(entity);
                }
            });
            return parentIds.map(id => entityGroups.get(id) || []);
        }, options);
    }
    static createCountLoader(repository, foreignKey, additionalWhere = {}, options = {}) {
        return new DataLoader(async (parentIds) => {
            const results = await repository
                .createQueryBuilder('entity')
                .select(`entity.${String(foreignKey)}`, 'parentId')
                .addSelect('COUNT(*)', 'count')
                .where(`entity.${String(foreignKey)} IN (:...parentIds)`, { parentIds })
                .andWhere(additionalWhere)
                .groupBy(`entity.${String(foreignKey)}`)
                .getRawMany();
            const countMap = new Map();
            results.forEach(result => {
                countMap.set(result.parentId, Number.parseInt(result.count, 10));
            });
            return parentIds.map(id => countMap.get(id) ?? 0);
        }, options);
    }
}
exports.DataLoaderFactory = DataLoaderFactory;
class DataLoaderContext {
    loaders;
    constructor() {
        this.loaders = new Map();
    }
    toStableScopeString(value) {
        if (Array.isArray(value)) {
            return `[${value.map(item => this.toStableScopeString(item)).join(',')}]`;
        }
        if (value && typeof value === 'object') {
            const entries = Object.entries(value).sort(([left], [right]) => left.localeCompare(right));
            return `{${entries
                .map(([key, entryValue]) => `${JSON.stringify(key)}:${this.toStableScopeString(entryValue)}`)
                .join(',')}}`;
        }
        return JSON.stringify(value);
    }
    buildScopeCacheKey(additionalWhere) {
        return this.toStableScopeString(additionalWhere);
    }
    getLoaderOrThrow(key) {
        const loader = this.loaders.get(key);
        if (!loader) {
            throw new Error(`Loader '${key}' is not initialized`);
        }
        return loader;
    }
    getEntityLoader(name, repository, idField = 'id', additionalWhere = {}) {
        const key = `entity:${name}:${String(idField)}:${this.buildScopeCacheKey(additionalWhere)}`;
        if (!this.loaders.has(key)) {
            this.loaders.set(key, DataLoaderFactory.createEntityLoader(repository, idField, additionalWhere));
        }
        return this.getLoaderOrThrow(key);
    }
    getRelationLoader(name, repository, foreignKey, additionalWhere = {}) {
        const key = `relation:${name}:${String(foreignKey)}:${this.buildScopeCacheKey(additionalWhere)}`;
        if (!this.loaders.has(key)) {
            this.loaders.set(key, DataLoaderFactory.createRelationLoader(repository, foreignKey, additionalWhere));
        }
        return this.getLoaderOrThrow(key);
    }
    getCountLoader(name, repository, foreignKey, additionalWhere = {}) {
        const key = `count:${name}:${String(foreignKey)}:${this.buildScopeCacheKey(additionalWhere)}`;
        if (!this.loaders.has(key)) {
            this.loaders.set(key, DataLoaderFactory.createCountLoader(repository, foreignKey, additionalWhere));
        }
        return this.getLoaderOrThrow(key);
    }
    clearAll() {
        this.loaders.forEach(loader => loader.clear());
    }
    clearLoader(name) {
        const keyPrefixes = ['entity', 'relation', 'count'].map(prefix => `${prefix}:${name}:`);
        this.loaders.forEach((loader, key) => {
            if (keyPrefixes.some(prefix => key.startsWith(prefix))) {
                loader.clear();
            }
        });
    }
}
exports.DataLoaderContext = DataLoaderContext;
//# sourceMappingURL=DataLoaderFactory.js.map