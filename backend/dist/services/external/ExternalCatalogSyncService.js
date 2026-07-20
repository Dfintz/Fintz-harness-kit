"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExternalCatalogSyncService = void 0;
const node_crypto_1 = require("node:crypto");
const axios_1 = __importDefault(require("axios"));
const data_source_1 = require("../../data-source");
const ExternalCatalogRecord_1 = require("../../models/ExternalCatalogRecord");
const logger_1 = require("../../utils/logger");
const SCMDB_VERSIONS_URL = 'https://scmdb.net/data/game-versions.json';
const SCMDB_DATA_BASE_URL = 'https://scmdb.net/data';
const SC_CRAFT_BLUEPRINTS_URL = 'https://sc-craft.tools/api/blueprints';
const SC_CRAFT_RESOURCES_URL = 'https://sc-craft.tools/api/resources';
const SC_CRAFT_STATS_URL = 'https://sc-craft.tools/api/stats';
const SC_CRAFT_VERSIONS_URL = 'https://sc-craft.tools/api/versions';
const SC_CRAFT_PAGE_SIZE = 100;
const SC_CRAFT_MAX_PAGES = 300;
class ExternalCatalogSyncService {
    repositoryOverride;
    client;
    constructor(repository, client) {
        this.repositoryOverride = repository;
        this.client =
            client ??
                axios_1.default.create({
                    timeout: 45000,
                    headers: {
                        'User-Agent': 'SC-Fleet-Manager/1.0 (External Catalog Sync)',
                        Accept: 'application/json',
                    },
                });
    }
    async synchronize(request = {}) {
        const startedAt = new Date();
        const dryRun = request.dryRun ?? true;
        const sampleSize = this.resolveSampleSize(request.sampleSize);
        const sources = this.resolveSources(request.sources);
        const warnings = [];
        const datasets = await this.collectDatasets(sources, warnings);
        const plans = [];
        for (const dataset of datasets) {
            const existing = await this.repository
                .createQueryBuilder('catalog')
                .where('catalog.source = :source', { source: dataset.source })
                .andWhere('catalog.recordType = :recordType', { recordType: dataset.recordType })
                .getMany();
            plans.push(this.buildDatasetPlan(dataset, existing, sampleSize));
        }
        if (!dryRun) {
            await this.applyPlans(plans);
        }
        const completedAt = new Date();
        const summary = plans.reduce((acc, plan) => {
            acc.incoming += plan.delta.incomingCount;
            acc.create += plan.delta.changes.create;
            acc.update += plan.delta.changes.update;
            acc.deactivate += plan.delta.changes.deactivate;
            acc.unchanged += plan.delta.changes.unchanged;
            return acc;
        }, {
            incoming: 0,
            create: 0,
            update: 0,
            deactivate: 0,
            unchanged: 0,
        });
        logger_1.logger.info('External catalog sync completed', {
            dryRun,
            sources,
            summary,
            warnings: warnings.length,
            durationMs: completedAt.getTime() - startedAt.getTime(),
        });
        return {
            dryRun,
            sources,
            startedAt: startedAt.toISOString(),
            completedAt: completedAt.toISOString(),
            durationMs: completedAt.getTime() - startedAt.getTime(),
            summary,
            datasets: plans.map(plan => plan.delta),
            warnings,
        };
    }
    get repository() {
        return this.repositoryOverride ?? data_source_1.AppDataSource.getRepository(ExternalCatalogRecord_1.ExternalCatalogRecord);
    }
    resolveSampleSize(sampleSize) {
        if (!Number.isFinite(sampleSize)) {
            return 25;
        }
        const parsed = Math.floor(sampleSize);
        if (parsed < 1) {
            return 1;
        }
        if (parsed > 100) {
            return 100;
        }
        return parsed;
    }
    resolveSources(sources) {
        if (!sources || sources.length === 0) {
            return [ExternalCatalogRecord_1.ExternalCatalogSource.SCMDB, ExternalCatalogRecord_1.ExternalCatalogSource.SC_CRAFT];
        }
        const normalized = new Set();
        for (const source of sources) {
            if (source === ExternalCatalogRecord_1.ExternalCatalogSource.SCMDB || source === ExternalCatalogRecord_1.ExternalCatalogSource.SC_CRAFT) {
                normalized.add(source);
            }
        }
        if (normalized.size === 0) {
            return [ExternalCatalogRecord_1.ExternalCatalogSource.SCMDB, ExternalCatalogRecord_1.ExternalCatalogSource.SC_CRAFT];
        }
        return [...normalized.values()];
    }
    async collectDatasets(sources, warnings) {
        const datasets = [];
        if (sources.includes(ExternalCatalogRecord_1.ExternalCatalogSource.SCMDB)) {
            datasets.push(await this.fetchScmdbContracts(warnings));
        }
        if (sources.includes(ExternalCatalogRecord_1.ExternalCatalogSource.SC_CRAFT)) {
            const scCraftDatasets = await this.fetchScCraftDatasets(warnings);
            datasets.push(...scCraftDatasets);
        }
        return datasets;
    }
    async fetchScmdbContracts(warnings) {
        const versionsResponse = await this.client.get(SCMDB_VERSIONS_URL);
        const versionInfo = this.resolveScmdbVersionInfo(versionsResponse.data);
        const mergedUrl = `${SCMDB_DATA_BASE_URL}/${versionInfo.file}`;
        const mergedResponse = await this.client.get(mergedUrl);
        const merged = this.requireObject(mergedResponse.data, 'SCMDB merged dataset');
        const contracts = this.toObjectArray(merged.contracts);
        let skipped = 0;
        const records = [];
        for (const contract of contracts) {
            const externalId = this.toNonEmptyString(contract.id);
            if (!externalId) {
                skipped++;
                continue;
            }
            const displayName = this.toNonEmptyString(contract.title) ??
                this.toNonEmptyString(contract.debugName) ??
                undefined;
            const category = this.toNonEmptyString(contract.category) ??
                this.toNonEmptyString(contract.missionType) ??
                undefined;
            const sourceVersion = this.toNonEmptyString(merged.version) ??
                this.toNonEmptyString(versionInfo.version) ??
                undefined;
            records.push(this.toIncomingRecord({
                source: ExternalCatalogRecord_1.ExternalCatalogSource.SCMDB,
                recordType: ExternalCatalogRecord_1.ExternalCatalogRecordType.CONTRACT,
                externalId,
                displayName,
                category,
                sourceVersion,
                payload: contract,
            }));
        }
        if (skipped > 0) {
            warnings.push(`SCMDB: skipped ${skipped} contract records without a stable id.`);
        }
        return {
            source: ExternalCatalogRecord_1.ExternalCatalogSource.SCMDB,
            recordType: ExternalCatalogRecord_1.ExternalCatalogRecordType.CONTRACT,
            records,
            metadata: {
                file: versionInfo.file,
                sourceVersion: this.toNonEmptyString(merged.version) ??
                    this.toNonEmptyString(versionInfo.version) ??
                    null,
            },
        };
    }
    resolveScmdbVersionInfo(data) {
        if (this.isObject(data)) {
            const file = this.toNonEmptyString(data.file) ?? this.toNonEmptyString(data.filename);
            if (file) {
                return {
                    file,
                    version: this.toNonEmptyString(data.version) ?? undefined,
                };
            }
        }
        if (Array.isArray(data)) {
            const candidates = data
                .filter(this.isObject)
                .map(item => ({
                file: this.toNonEmptyString(item.file) ?? this.toNonEmptyString(item.filename),
                version: this.toNonEmptyString(item.version),
                active: this.toBoolean(item.active),
            }))
                .filter(item => Boolean(item.file));
            if (candidates.length > 0) {
                const selected = candidates.find(item => item.active) ?? candidates[0];
                return {
                    file: selected.file,
                    version: selected.version ?? undefined,
                };
            }
        }
        throw new Error('SCMDB version payload did not include a usable merged file reference.');
    }
    async fetchScCraftDatasets(warnings) {
        const [blueprints, stats, versions] = await Promise.all([
            this.fetchAllScCraftBlueprints(),
            this.fetchOptionalObject(SC_CRAFT_STATS_URL, warnings, 'SC Craft stats'),
            this.fetchOptionalArray(SC_CRAFT_VERSIONS_URL, warnings, 'SC Craft versions'),
        ]);
        const resourcesResponse = await this.client.get(SC_CRAFT_RESOURCES_URL);
        const resources = this.toObjectArray(resourcesResponse.data);
        const statsVersion = stats ? this.toNonEmptyString(stats.version) : undefined;
        let skippedBlueprints = 0;
        const blueprintRecords = [];
        for (const blueprint of blueprints.items) {
            const externalId = this.toNonEmptyString(blueprint.blueprint_id) ?? this.toNonEmptyString(blueprint.id);
            if (!externalId) {
                skippedBlueprints++;
                continue;
            }
            const sourceVersion = this.toNonEmptyString(blueprint.version) ??
                statsVersion ??
                this.findActiveVersion(versions);
            blueprintRecords.push(this.toIncomingRecord({
                source: ExternalCatalogRecord_1.ExternalCatalogSource.SC_CRAFT,
                recordType: ExternalCatalogRecord_1.ExternalCatalogRecordType.BLUEPRINT,
                externalId,
                displayName: this.toNonEmptyString(blueprint.name) ?? undefined,
                category: this.toNonEmptyString(blueprint.category) ?? undefined,
                sourceVersion,
                payload: blueprint,
            }));
        }
        if (skippedBlueprints > 0) {
            warnings.push(`SC Craft: skipped ${skippedBlueprints} blueprint records without a stable id.`);
        }
        let skippedResources = 0;
        const resourceRecords = [];
        for (const resource of resources) {
            const externalId = this.toNonEmptyString(resource.guid) ?? this.toNonEmptyString(resource.id);
            if (!externalId) {
                skippedResources++;
                continue;
            }
            resourceRecords.push(this.toIncomingRecord({
                source: ExternalCatalogRecord_1.ExternalCatalogSource.SC_CRAFT,
                recordType: ExternalCatalogRecord_1.ExternalCatalogRecordType.RESOURCE,
                externalId,
                displayName: this.toNonEmptyString(resource.name) ?? undefined,
                category: 'resource',
                sourceVersion: statsVersion ?? this.findActiveVersion(versions),
                payload: resource,
            }));
        }
        if (skippedResources > 0) {
            warnings.push(`SC Craft: skipped ${skippedResources} resource records without a stable id.`);
        }
        const activeVersion = this.findActiveVersion(versions);
        return [
            {
                source: ExternalCatalogRecord_1.ExternalCatalogSource.SC_CRAFT,
                recordType: ExternalCatalogRecord_1.ExternalCatalogRecordType.BLUEPRINT,
                records: blueprintRecords,
                metadata: {
                    pageSize: SC_CRAFT_PAGE_SIZE,
                    pagesFetched: blueprints.pagesFetched,
                    reportedTotalItems: blueprints.reportedTotal,
                    sourceVersion: statsVersion ?? activeVersion ?? null,
                },
            },
            {
                source: ExternalCatalogRecord_1.ExternalCatalogSource.SC_CRAFT,
                recordType: ExternalCatalogRecord_1.ExternalCatalogRecordType.RESOURCE,
                records: resourceRecords,
                metadata: {
                    totalResources: resources.length,
                    sourceVersion: statsVersion ?? activeVersion ?? null,
                },
            },
        ];
    }
    async fetchAllScCraftBlueprints() {
        const items = [];
        let page = 1;
        let pages = 1;
        let reportedTotal = 0;
        while (page <= pages) {
            const response = await this.client.get(SC_CRAFT_BLUEPRINTS_URL, {
                params: {
                    page,
                    limit: SC_CRAFT_PAGE_SIZE,
                },
            });
            const payload = this.requireObject(response.data, 'SC Craft blueprints response');
            const pageItems = this.toObjectArray(payload.items);
            items.push(...pageItems);
            const pagination = this.isObject(payload.pagination) ? payload.pagination : undefined;
            const parsedPages = this.toPositiveInteger(pagination?.pages);
            const parsedTotal = this.toPositiveInteger(pagination?.total);
            if (parsedPages) {
                pages = parsedPages;
            }
            if (parsedTotal) {
                reportedTotal = parsedTotal;
            }
            if (pages > SC_CRAFT_MAX_PAGES) {
                throw new Error(`SC Craft blueprint pagination exceeded safety limit (${SC_CRAFT_MAX_PAGES} pages).`);
            }
            page++;
        }
        return {
            items,
            pagesFetched: pages,
            reportedTotal,
        };
    }
    async fetchOptionalObject(url, warnings, label) {
        try {
            const response = await this.client.get(url);
            return this.requireObject(response.data, label);
        }
        catch (error) {
            warnings.push(`${label}: ${error instanceof Error ? error.message : String(error)}`);
            return null;
        }
    }
    async fetchOptionalArray(url, warnings, label) {
        try {
            const response = await this.client.get(url);
            return this.toObjectArray(response.data);
        }
        catch (error) {
            warnings.push(`${label}: ${error instanceof Error ? error.message : String(error)}`);
            return null;
        }
    }
    findActiveVersion(versions) {
        if (!versions || versions.length === 0) {
            return undefined;
        }
        const active = versions.find(version => this.toBoolean(version.active));
        const fallback = active ?? versions[0];
        return this.toNonEmptyString(fallback.version) ?? undefined;
    }
    buildDatasetPlan(dataset, existingRecords, sampleSize) {
        const existingById = new Map();
        for (const record of existingRecords) {
            existingById.set(record.externalId, record);
        }
        const incomingIds = new Set();
        const createItems = [];
        const updateItems = [];
        let unchanged = 0;
        for (const incoming of dataset.records) {
            incomingIds.add(incoming.externalId);
            const existing = existingById.get(incoming.externalId);
            if (!existing) {
                createItems.push(incoming);
                continue;
            }
            const changedFields = this.getChangedFields(existing, incoming);
            if (changedFields.length > 0) {
                updateItems.push({ existing, incoming, changedFields });
            }
            else {
                unchanged++;
            }
        }
        const deactivateItems = existingRecords.filter(existing => existing.isActive && !incomingIds.has(existing.externalId));
        const delta = {
            source: dataset.source,
            recordType: dataset.recordType,
            incomingCount: dataset.records.length,
            existingCount: existingRecords.length,
            changes: {
                create: createItems.length,
                update: updateItems.length,
                deactivate: deactivateItems.length,
                unchanged,
            },
            samples: {
                create: createItems.slice(0, sampleSize).map(item => ({
                    externalId: item.externalId,
                    displayName: item.displayName,
                })),
                update: updateItems.slice(0, sampleSize).map(item => ({
                    externalId: item.incoming.externalId,
                    displayName: item.incoming.displayName,
                    changedFields: item.changedFields,
                })),
                deactivate: deactivateItems.slice(0, sampleSize).map(item => ({
                    externalId: item.externalId,
                    displayName: item.displayName ?? undefined,
                })),
            },
            metadata: dataset.metadata,
        };
        return {
            dataset,
            delta,
            createItems,
            updateItems,
            deactivateItems,
        };
    }
    getChangedFields(existing, incoming) {
        const changedFields = [];
        if (this.normalizeString(existing.displayName) !== this.normalizeString(incoming.displayName)) {
            changedFields.push('displayName');
        }
        if (this.normalizeString(existing.category) !== this.normalizeString(incoming.category)) {
            changedFields.push('category');
        }
        if (this.normalizeString(existing.sourceVersion) !== this.normalizeString(incoming.sourceVersion)) {
            changedFields.push('sourceVersion');
        }
        if (existing.payloadHash !== incoming.payloadHash) {
            const payloadKeys = this.diffTopLevelPayloadKeys(existing.payload, incoming.payload);
            if (payloadKeys.length > 0) {
                changedFields.push(...payloadKeys.map(key => `payload.${key}`));
            }
            else {
                changedFields.push('payload');
            }
        }
        if (!existing.isActive) {
            changedFields.push('isActive');
        }
        return changedFields;
    }
    diffTopLevelPayloadKeys(existingPayload, incomingPayload) {
        const keys = new Set([
            ...Object.keys(existingPayload),
            ...Object.keys(incomingPayload),
        ]);
        const changedKeys = [];
        for (const key of [...keys.values()].sort()) {
            const existingValue = this.stableStringify(existingPayload[key]);
            const incomingValue = this.stableStringify(incomingPayload[key]);
            if (existingValue !== incomingValue) {
                changedKeys.push(key);
            }
            if (changedKeys.length >= 8) {
                break;
            }
        }
        return changedKeys;
    }
    async applyPlans(plans) {
        if (!data_source_1.AppDataSource.isInitialized) {
            throw new Error('Database is not initialized.');
        }
        const queryRunner = data_source_1.AppDataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();
        try {
            const repository = queryRunner.manager.getRepository(ExternalCatalogRecord_1.ExternalCatalogRecord);
            const now = new Date();
            for (const plan of plans) {
                if (plan.createItems.length > 0) {
                    const createEntities = plan.createItems.map(item => repository.create({
                        source: item.source,
                        recordType: item.recordType,
                        externalId: item.externalId,
                        displayName: item.displayName,
                        category: item.category,
                        sourceVersion: item.sourceVersion,
                        payloadHash: item.payloadHash,
                        payload: item.payload,
                        isActive: true,
                        firstSeenAt: now,
                        lastSeenAt: now,
                        lastSyncedAt: now,
                    }));
                    await repository.save(createEntities, { chunk: 200 });
                }
                if (plan.updateItems.length > 0) {
                    const updateEntities = plan.updateItems.map(item => repository.create({
                        ...item.existing,
                        displayName: item.incoming.displayName,
                        category: item.incoming.category,
                        sourceVersion: item.incoming.sourceVersion,
                        payloadHash: item.incoming.payloadHash,
                        payload: item.incoming.payload,
                        isActive: true,
                        lastSeenAt: now,
                        lastSyncedAt: now,
                    }));
                    await repository.save(updateEntities, { chunk: 200 });
                }
                if (plan.deactivateItems.length > 0) {
                    const deactivateIds = plan.deactivateItems.map(item => item.id);
                    for (const idsChunk of this.chunk(deactivateIds, 200)) {
                        await repository
                            .createQueryBuilder()
                            .update(ExternalCatalogRecord_1.ExternalCatalogRecord)
                            .set({
                            isActive: false,
                            lastSyncedAt: now,
                        })
                            .where('id IN (:...ids)', { ids: idsChunk })
                            .execute();
                    }
                }
            }
            await queryRunner.commitTransaction();
        }
        catch (error) {
            await queryRunner.rollbackTransaction();
            throw error;
        }
        finally {
            await queryRunner.release();
        }
    }
    toIncomingRecord(input) {
        return {
            source: input.source,
            recordType: input.recordType,
            externalId: input.externalId,
            displayName: this.normalizeString(input.displayName) ?? undefined,
            category: this.normalizeString(input.category) ?? undefined,
            sourceVersion: this.normalizeString(input.sourceVersion) ?? undefined,
            payload: input.payload,
            payloadHash: (0, node_crypto_1.createHash)('sha256').update(this.stableStringify(input.payload)).digest('hex'),
        };
    }
    stableStringify(value) {
        if (value === null || value === undefined) {
            return 'null';
        }
        if (typeof value === 'number' || typeof value === 'boolean') {
            return JSON.stringify(value);
        }
        if (typeof value === 'string') {
            return JSON.stringify(value);
        }
        if (Array.isArray(value)) {
            return `[${value.map(item => this.stableStringify(item)).join(',')}]`;
        }
        if (!this.isObject(value)) {
            return JSON.stringify(String(value));
        }
        const sortedEntries = Object.entries(value).sort(([left], [right]) => left.localeCompare(right));
        return `{${sortedEntries
            .map(([key, entryValue]) => `${JSON.stringify(key)}:${this.stableStringify(entryValue)}`)
            .join(',')}}`;
    }
    toObjectArray(value) {
        if (!Array.isArray(value)) {
            return [];
        }
        return value.filter(this.isObject);
    }
    requireObject(value, label) {
        if (!this.isObject(value)) {
            throw new Error(`${label} did not return a JSON object.`);
        }
        return value;
    }
    isObject(value) {
        return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
    }
    toNonEmptyString(value) {
        if (typeof value !== 'string') {
            return null;
        }
        const trimmed = value.trim();
        return trimmed.length > 0 ? trimmed : null;
    }
    normalizeString(value) {
        if (typeof value !== 'string') {
            return null;
        }
        const trimmed = value.trim();
        return trimmed.length > 0 ? trimmed : null;
    }
    toBoolean(value) {
        if (typeof value === 'boolean') {
            return value;
        }
        if (typeof value === 'number') {
            return value !== 0;
        }
        if (typeof value === 'string') {
            const normalized = value.trim().toLowerCase();
            return normalized === 'true' || normalized === '1' || normalized === 'yes';
        }
        return false;
    }
    toPositiveInteger(value) {
        if (typeof value === 'number' && Number.isInteger(value) && value > 0) {
            return value;
        }
        if (typeof value === 'string') {
            const parsed = Number.parseInt(value, 10);
            if (Number.isInteger(parsed) && parsed > 0) {
                return parsed;
            }
        }
        return null;
    }
    chunk(items, chunkSize) {
        const chunks = [];
        for (let index = 0; index < items.length; index += chunkSize) {
            chunks.push(items.slice(index, index + chunkSize));
        }
        return chunks;
    }
}
exports.ExternalCatalogSyncService = ExternalCatalogSyncService;
//# sourceMappingURL=ExternalCatalogSyncService.js.map