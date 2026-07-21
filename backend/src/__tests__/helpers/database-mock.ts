/**
 * Database Mocking Utilities for Tests
 */
import { DataSource, ObjectLiteral, Repository, SelectQueryBuilder } from 'typeorm';

// Type for entity storage values
type EntityRecord = Record<string, unknown> & { id: string };

// In-memory storage for entities
const entityStorage = new Map<string, Map<string, EntityRecord>>();

function getEntityStore(entityName: string): Map<string, EntityRecord> {
  if (!entityStorage.has(entityName)) {
    entityStorage.set(entityName, new Map());
  }
  return entityStorage.get(entityName)!;
}

export function clearEntityStorage() {
  entityStorage.clear();
}

type WhereCondition = string | Record<string, unknown>;

export function createMockQueryBuilder<T extends ObjectLiteral>(
  entityName: string,
  storage: Map<string, EntityRecord>
) {
  let whereConditions: WhereCondition[] = [];
  const orWhereConditions: WhereCondition[] = [];
  let selectFields: string[] = [];
  const selectAliases: Map<string, string> = new Map(); // Track field -> alias mapping
  let addSelectFields: string[] = [];
  let groupByFields: string[] = [];
  let limitValue: number | undefined;
  let skipValue: number = 0;
  const parameters: Record<string, unknown> = {};

  // Helper to convert SQL LIKE pattern to regex
  const likePatternToRegex = (pattern: string): RegExp => {
    // First escape all regex special chars
    let regexPattern = String(pattern).replace(/[.+?^${}()|[\]\\]/g, '\\$&'); // Escape special chars but not %

    // Then convert SQL wildcards to regex
    regexPattern = regexPattern.replace(/%/g, '.*');

    return new RegExp(`^${regexPattern}$`, 'i');
  };

  const builder: SelectQueryBuilder<T> = {
    select: jest.fn().mockImplementation((fields, alias?: string) => {
      // Store field expressions and track aliases for aggregate queries
      // This supports TypeORM patterns like .select('COUNT(*)', 'total')
      if (Array.isArray(fields)) {
        selectFields = fields;
      } else {
        selectFields = [fields];
        // If alias is provided, store the mapping for getRawOne/getRawMany
        if (alias) {
          selectAliases.set(fields, alias);
        }
      }
      return builder;
    }),
    where: jest.fn().mockImplementation((condition, params) => {
      whereConditions = [condition];
      if (params) {
        Object.assign(parameters, params);
      }
      return builder;
    }),
    andWhere: jest.fn().mockImplementation((condition, params) => {
      whereConditions.push(condition);
      if (params) {
        Object.assign(parameters, params);
      }
      return builder;
    }),
    orWhere: jest.fn().mockImplementation((condition, params) => {
      orWhereConditions.push(condition);
      if (params) {
        Object.assign(parameters, params);
      }
      return builder;
    }),
    leftJoin: jest.fn().mockReturnThis(),
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    innerJoin: jest.fn().mockReturnThis(),
    innerJoinAndSelect: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    addOrderBy: jest.fn().mockReturnThis(),
    setLock: jest.fn().mockReturnThis(),
    connection: { options: { type: 'sqlite' } },
    limit: jest.fn().mockImplementation(value => {
      limitValue = value;
      return builder;
    }),
    offset: jest.fn().mockReturnThis(),
    skip: jest.fn().mockImplementation(value => {
      skipValue = value;
      return builder;
    }),
    take: jest.fn().mockImplementation(value => {
      limitValue = value;
      return builder;
    }),
    getMany: jest.fn().mockImplementation(async () => {
      let results = Array.from(storage.values());

      // Helper to evaluate a condition string
      const evaluateCondition = (entity: EntityRecord, condition: string): boolean => {
        // Handle composite OR conditions in parentheses: "(condition1 OR condition2 OR ...)"
        const orInParensMatch = condition.match(/^\((.*)\)$/i);
        if (orInParensMatch) {
          const innerCondition = orInParensMatch[1];
          // Split by OR (case-insensitive) but not within function calls
          const orParts = innerCondition.split(/\s+OR\s+/i);
          if (orParts.length > 1) {
            return orParts.some(part => evaluateCondition(entity, part.trim()));
          }
          // Split by AND for composite conditions
          const andParts = innerCondition.split(/\s+AND\s+/i);
          if (andParts.length > 1) {
            return andParts.every(part => evaluateCondition(entity, part.trim()));
          }
        }

        // Handle "alias.field <= :param" pattern (less than or equal)
        const lteMatch = condition.match(/(\w+)\.(\w+)\s*<=\s*:(\w+)/);
        if (lteMatch) {
          const [, , field, param] = lteMatch;
          const entityValue = entity[field];
          const paramValue = parameters[param];
          if (
            entityValue === null ||
            entityValue === undefined ||
            paramValue === null ||
            paramValue === undefined
          ) {
            return false;
          }
          // Handle Date comparison
          if (entityValue instanceof Date && paramValue instanceof Date) {
            return entityValue.getTime() <= paramValue.getTime();
          }
          return entityValue <= paramValue;
        }

        // Handle "alias.field >= :param" pattern (greater than or equal)
        const gteMatch = condition.match(/(\w+)\.(\w+)\s*>=\s*:(\w+)/);
        if (gteMatch) {
          const [, , field, param] = gteMatch;
          const entityValue = entity[field];
          const paramValue = parameters[param];
          if (
            entityValue === null ||
            entityValue === undefined ||
            paramValue === null ||
            paramValue === undefined
          ) {
            return false;
          }
          // Handle Date comparison
          if (entityValue instanceof Date && paramValue instanceof Date) {
            return entityValue.getTime() >= paramValue.getTime();
          }
          return entityValue >= paramValue;
        }

        // Handle "alias.field IS NOT NULL" pattern
        const isNotNullMatch = condition.match(/(\w+)\.(\w+)\s+IS\s+NOT\s+NULL/i);
        if (isNotNullMatch) {
          const [, , field] = isNotNullMatch;
          return entity[field] !== null && entity[field] !== undefined;
        }

        // Handle "alias.field IS NULL" pattern
        const isNullMatch = condition.match(/(\w+)\.(\w+)\s+IS\s+NULL/i);
        if (isNullMatch) {
          const [, , field] = isNullMatch;
          return entity[field] === null || entity[field] === undefined;
        }

        // Handle "alias.field NOT IN (:...param)" pattern (array not-in)
        const notInMatch = condition.match(/(\w+)\.(\w+)\s+NOT\s+IN\s+\(:\.\.\.(\w+)\)/i);
        if (notInMatch) {
          const [, , field, param] = notInMatch;
          const values = parameters[param];
          if (!Array.isArray(values)) {
            return true;
          }
          return !values.includes(entity[field]);
        }

        // Handle "alias.field IN (:...param)" pattern (array in)
        const inMatch = condition.match(/(\w+)\.(\w+)\s+IN\s+\(:\.\.\.(\w+)\)/i);
        if (inMatch) {
          const [, , field, param] = inMatch;
          const values = parameters[param];
          if (!Array.isArray(values)) {
            return false;
          }
          return values.includes(entity[field]);
        }

        // Handle "alias.field != :param" pattern (inequality)
        const notEqualMatch = condition.match(/(\w+)\.(\w+)\s*!=\s*:(\w+)/);
        if (notEqualMatch) {
          const [, , field, param] = notEqualMatch;
          return entity[field] !== parameters[param];
        }

        // Handle "alias.field = :param" pattern (with any alias, not just 'entity')
        const simpleMatch = condition.match(/(\w+)\.(\w+)\s*=\s*:(\w+)/);
        if (simpleMatch) {
          const [, , field, param] = simpleMatch;
          return entity[field] === parameters[param];
        }

        // Handle "LOWER(alias.field) = LOWER(:param)" pattern for case-insensitive equality
        const lowerEqMatch = condition.match(/LOWER\((\w+)\.(\w+)\)\s*=\s*LOWER\(:(\w+)\)/i);
        if (lowerEqMatch) {
          const [, , field, param] = lowerEqMatch;
          const value = entity[field];
          const paramValue = parameters[param];

          if (
            value === undefined ||
            value === null ||
            paramValue === undefined ||
            paramValue === null
          ) {
            return false;
          }

          return String(value).toLowerCase() === String(paramValue).toLowerCase();
        }

        // Handle "LOWER(alias.field) LIKE LOWER(:param)" pattern for case-insensitive LIKE
        const lowerLikeMatch = condition.match(/LOWER\((\w+)\.(\w+)\)\s+LIKE\s+LOWER\(:(\w+)\)/i);
        if (lowerLikeMatch) {
          const [, , field, param] = lowerLikeMatch;
          const pattern = parameters[param];
          const value = entity[field];

          if (value === undefined || value === null || pattern === undefined || pattern === null) {
            return false;
          }

          const regex = likePatternToRegex(pattern);
          return regex.test(String(value));
        }

        // Handle "alias.field ILIKE :param" pattern for case-insensitive matching
        const ilikeMatch = condition.match(/(\w+)\.(\w+)\s+ILIKE\s+:(\w+)/i);
        if (ilikeMatch) {
          const [, , field, param] = ilikeMatch;
          const pattern = parameters[param];
          const value = entity[field];

          if (value === undefined || value === null || pattern === undefined || pattern === null) {
            return false;
          }

          const regex = likePatternToRegex(pattern);
          return regex.test(String(value));
        }

        // Handle ":param = ANY(alias.field)" pattern for array matching
        const anyMatch = condition.match(/:(\w+)\s*=\s*ANY\((\w+)\.(\w+)\)/);
        if (anyMatch) {
          const [, param, , field] = anyMatch;
          const value = parameters[param];
          const array = entity[field];
          return array && Array.isArray(array) && array.includes(value);
        }

        return true;
      };

      // Apply where conditions (AND logic)
      if (whereConditions.length > 0) {
        results = results.filter(entity =>
          whereConditions.every(condition => {
            if (typeof condition === 'string') {
              return evaluateCondition(entity, condition);
            } else if (typeof condition === 'object') {
              return Object.entries(condition).every(([key, value]) => entity[key] === value);
            }
            return true;
          })
        );
      }

      // Apply orWhere conditions (OR logic) - entities matching ANY orWhere are included
      if (orWhereConditions.length > 0) {
        const orResults = Array.from(storage.values()).filter(entity =>
          orWhereConditions.some(condition => {
            if (typeof condition === 'string') {
              return evaluateCondition(entity, condition);
            } else if (typeof condition === 'object') {
              return Object.entries(condition).every(([key, value]) => entity[key] === value);
            }
            return false;
          })
        );

        // Combine with where results (union)
        if (whereConditions.length > 0) {
          const resultIds = new Set(results.map(r => r.id));
          orResults.forEach(entity => {
            if (!resultIds.has(entity.id)) {
              results.push(entity);
            }
          });
        } else {
          results = orResults;
        }
      }

      // Apply pagination
      if (skipValue) {
        results = results.slice(skipValue);
      }
      if (limitValue) {
        results = results.slice(0, limitValue);
      }

      return results;
    }),
    getOne: jest.fn().mockImplementation(async () => {
      const results = await builder.getMany();
      return results.length > 0 ? results[0] : null;
    }),
    getCount: jest.fn().mockImplementation(async () => storage.size),
    getManyAndCount: jest.fn().mockImplementation(async () => {
      const results = await builder.getMany();
      return [results, results.length];
    }),
    delete: jest.fn().mockReturnThis(),
    execute: jest.fn().mockImplementation(async () => {
      // For delete queries
      const results = await builder.getMany();
      results.forEach((entity: EntityRecord) => {
        storage.delete(entity.id);
      });
      return { affected: results.length, raw: {} };
    }),
    setParameter: jest.fn().mockImplementation((key, value) => {
      parameters[key] = value;
      return builder;
    }),
    setParameters: jest.fn().mockImplementation(params => {
      Object.assign(parameters, params);
      return builder;
    }),
    addSelect: jest.fn().mockImplementation((field, alias?: string) => {
      if (alias) {
        addSelectFields.push(`${field}, ${alias}`);
      } else {
        addSelectFields.push(field);
      }
      return builder;
    }),
    groupBy: jest.fn().mockImplementation(field => {
      groupByFields = [field];
      return builder;
    }),
    addGroupBy: jest.fn().mockImplementation(field => {
      groupByFields.push(field);
      return builder;
    }),
    clone: jest.fn().mockImplementation(() => {
      // Create a new builder that shares the same storage and current where/params state
      const cloned = createMockQueryBuilder<T>(entityName, storage);
      // Copy current where conditions and parameters to the clone
      // First condition via where(), rest via andWhere()
      const allConditions = [...whereConditions];
      if (allConditions.length > 0) {
        cloned.where(allConditions[0], { ...parameters });
        for (let i = 1; i < allConditions.length; i++) {
          cloned.andWhere(allConditions[i], {});
        }
      }
      return cloned;
    }),
    getRawMany: jest.fn().mockImplementation(async () => {
      // Apply where filters first using getMany logic
      const filtered = await builder.getMany();

      if (groupByFields.length === 0) {
        return filtered;
      }

      // Parse group by field names (e.g., 'alias.field' -> 'field')
      const groupFields = groupByFields.map(f => {
        const parts = f.split('.');
        return parts.length > 1 ? parts[1] : parts[0];
      });

      // Group the results
      const groups = new Map<string, EntityRecord[]>();
      for (const entity of filtered) {
        const key = groupFields.map(f => String(entity[f] ?? '')).join('|');
        if (!groups.has(key)) {
          groups.set(key, []);
        }
        groups.get(key)!.push(entity);
      }

      // Build raw results with COUNT
      const rawResults: Record<string, unknown>[] = [];
      for (const [, groupEntities] of groups) {
        const row: Record<string, unknown> = {};
        // Include group by field values
        for (const field of groupFields) {
          row[field] = groupEntities[0][field];
        }
        // Include selected field values from first entity
        for (const sf of selectFields) {
          const parsed = sf.split('.');
          const fieldName = parsed.length > 1 ? parsed[1] : parsed[0];
          if (!groupFields.includes(fieldName)) {
            row[fieldName] = groupEntities[0][fieldName];
          }
        }
        for (const sf of addSelectFields) {
          const parsed = sf.split('.');
          const fieldName = parsed.length > 1 ? parsed[1] : parsed[0];
          if (!groupFields.includes(fieldName)) {
            row[fieldName] = groupEntities[0][fieldName];
          }
        }
        row['count'] = String(groupEntities.length);
        rawResults.push(row);
      }
      return rawResults;
    }),
    getRawOne: jest.fn().mockImplementation(async () => {
      // Apply where filters using getMany logic
      const filtered = await builder.getMany();

      // Parse select fields for aggregate functions
      const allFields = [...selectFields, ...addSelectFields];
      const row: Record<string, unknown> = {};

      for (const field of allFields) {
        // Check if we have a stored alias for this field
        const storedAlias = selectAliases.get(field);

        // Handle COUNT(*)
        if (/COUNT\(\*\)/i.test(field)) {
          const alias =
            storedAlias || field.split(',').pop()?.trim().replace(/['"]/g, '') || 'count';
          row[alias] = String(filtered.length);
        }
        // Handle COALESCE(SUM(alias.field), 0)
        else if (/COALESCE\s*\(\s*SUM/i.test(field)) {
          const aliasMatch = field.match(/,\s*['"]?(\w+)['"]?\s*\)?\s*$/);
          const alias = storedAlias || (aliasMatch ? aliasMatch[1] : 'sum');
          const fieldMatch = field.match(/SUM\(\s*\w+\.(\w+)\s*\)/i);
          if (fieldMatch) {
            const sumField = fieldMatch[1];
            const sum = filtered.reduce((acc, e) => {
              const val = Number(e[sumField]);
              return acc + (isNaN(val) ? 0 : val);
            }, 0);
            row[alias] = String(sum);
          } else {
            row[alias] = '0';
          }
        }
        // Handle SUM(alias.field)
        else if (/SUM\(/i.test(field)) {
          const aliasMatch = field.match(/,\s*['"]?(\w+)['"]?\s*$/);
          const alias = storedAlias || (aliasMatch ? aliasMatch[1] : 'sum');
          const fieldMatch = field.match(/SUM\(\s*\w+\.(\w+)\s*\)/i);
          if (fieldMatch) {
            const sumField = fieldMatch[1];
            const sum = filtered.reduce((acc, e) => acc + (Number(e[sumField]) || 0), 0);
            row[alias] = String(sum);
          }
        }
        // Simple alias.field, 'alias' pattern
        else {
          const parts = field.split(',').map(p => p.trim().replace(/['"]/g, ''));
          if (parts.length === 2) {
            const fieldParts = parts[0].split('.');
            const fieldName = fieldParts.length > 1 ? fieldParts[1] : fieldParts[0];
            row[parts[1]] = filtered.length > 0 ? filtered[0][fieldName] : null;
          }
        }
      }

      return Object.keys(row).length > 0 ? row : null;
    }),
  };
  return builder as unknown as SelectQueryBuilder<T>;
}

export function mockRepository<T extends ObjectLiteral>(entityName: string) {
  const storage = getEntityStore(entityName);

  type FindOptions = {
    where?: Record<string, unknown>;
    order?: Record<string, 'ASC' | 'DESC'>;
    take?: number;
    skip?: number;
  };

  return {
    find: jest.fn().mockImplementation(async (options?: FindOptions) => {
      let results = Array.from(storage.values());

      if (options?.where) {
        results = results.filter((entity: EntityRecord) =>
          Object.entries(options.where!).every(([key, value]) => {
            // Handle FindOperator (TypeORM's ILike, Like, etc.)
            if (value && typeof value === 'object' && '_type' in value && '_value' in value) {
              const operatorType = value._type;
              const operatorValue = value._value;
              const entityValue = entity[key];

              if (entityValue === undefined || entityValue === null) {
                return false;
              }

              // Handle ILIKE (case-insensitive LIKE)
              if (operatorType === 'ilike') {
                if (operatorValue === undefined || operatorValue === null) {
                  return false;
                }
                // For simple string comparison (no wildcards in test data)
                return String(entityValue).toLowerCase() === String(operatorValue).toLowerCase();
              }

              // For other operators, do exact match
              return entity[key] === operatorValue;
            }

            // Regular equality check
            return entity[key] === value;
          })
        );
      }

      // Handle ordering
      if (options?.order) {
        results.sort((a: EntityRecord, b: EntityRecord) => {
          for (const [field, direction] of Object.entries(options.order!)) {
            const aVal = a[field];
            const bVal = b[field];

            if (aVal === bVal) {
              continue;
            }

            // Handle null/undefined
            if (aVal === null || aVal === undefined) {
              return 1;
            }
            if (bVal === null || bVal === undefined) {
              return -1;
            }

            // Compare values
            let comparison = 0;
            if (typeof aVal === 'string' && typeof bVal === 'string') {
              comparison = aVal.localeCompare(bVal);
            } else if (aVal < bVal) {
              comparison = -1;
            } else if (aVal > bVal) {
              comparison = 1;
            }

            // Apply sort direction
            // Handle both 'ASC'/'DESC' and undefined (default to ASC)
            const dirStr = direction ? String(direction).toUpperCase() : 'ASC';
            const isDescending = dirStr === 'DESC';
            return isDescending ? -comparison : comparison;
          }
          return 0;
        });
      }

      if (options?.take) {
        results = results.slice(0, options.take);
      }

      if (options?.skip) {
        results = results.slice(options.skip);
      }

      return results;
    }),
    findOne: jest.fn().mockImplementation(async (options?: FindOptions) => {
      if (options?.where) {
        const results = Array.from(storage.values()).filter((entity: EntityRecord) =>
          Object.entries(options.where!).every(([key, value]) => entity[key] === value)
        );
        return results.length > 0 ? results[0] : null;
      }
      return null;
    }),
    findOneBy: jest.fn().mockImplementation(async (where: Record<string, unknown>) => {
      const results = Array.from(storage.values()).filter((entity: EntityRecord) =>
        Object.entries(where).every(([key, value]) => entity[key] === value)
      );
      return results.length > 0 ? results[0] : null;
    }),
    findAndCount: jest.fn().mockImplementation(async (options?: FindOptions) => {
      const results = await mockRepository(entityName).find(options);
      return [results, results.length];
    }),
    save: jest.fn().mockImplementation(async (entityOrArray: EntityRecord | EntityRecord[]) => {
      // Helper to add TenantEntity methods
      const addTenantMethods = (entity: EntityRecord): EntityRecord => {
        // Auto-generate createdAt and updatedAt if not present
        const now = new Date();
        if (!entity.createdAt) {
          entity.createdAt = now;
        }
        if (!entity.updatedAt) {
          entity.updatedAt = now;
        }

        if (!entity.isSharedWith) {
          entity.isSharedWith = function (
            this: EntityRecord & { sharedWithOrgs?: string[] },
            targetOrgId: string
          ) {
            return this.sharedWithOrgs ? this.sharedWithOrgs.includes(targetOrgId) : false;
          };
        }
        if (!entity.addSharedOrg) {
          entity.addSharedOrg = function (
            this: EntityRecord & { sharedWithOrgs?: string[] },
            targetOrgId: string
          ) {
            if (!this.sharedWithOrgs) {
              this.sharedWithOrgs = [];
            }
            if (!this.sharedWithOrgs.includes(targetOrgId)) {
              this.sharedWithOrgs.push(targetOrgId);
            }
          };
        }
        if (!entity.removeSharedOrg) {
          entity.removeSharedOrg = function (
            this: EntityRecord & { sharedWithOrgs?: string[] },
            targetOrgId: string
          ) {
            if (!this.sharedWithOrgs) {
              return;
            }
            this.sharedWithOrgs = this.sharedWithOrgs.filter((id: string) => id !== targetOrgId);
          };
        }
        if (!entity.isOwnedBy) {
          entity.isOwnedBy = function (
            this: EntityRecord & { organizationId?: string },
            organizationId: string
          ) {
            return this.organizationId === organizationId;
          };
        }
        return entity;
      };

      // Handle both single entity and array of entities
      if (Array.isArray(entityOrArray)) {
        return Promise.all(
          entityOrArray.map(async (entity: EntityRecord) => {
            const id = entity.id || `${entityName}-${Date.now()}-${Math.random()}`;
            const savedEntity = addTenantMethods(entity);
            savedEntity.id = id;
            storage.set(id, savedEntity);
            return savedEntity;
          })
        );
      } else {
        const entity = entityOrArray;
        const id = entity.id || `${entityName}-${Date.now()}-${Math.random()}`;
        const savedEntity = addTenantMethods(entity);
        savedEntity.id = id;
        storage.set(id, savedEntity);
        return savedEntity;
      }
    }),
    create: jest.fn().mockImplementation((data: Partial<EntityRecord>): EntityRecord => {
      // Add TenantEntity methods to created entities
      const entity = { ...data } as EntityRecord;

      // Apply default values for common fields
      if (entity.isActive === undefined) {
        entity.isActive = true;
      }

      entity.isSharedWith = function (
        this: EntityRecord & { sharedWithOrgs?: string[] },
        targetOrgId: string
      ) {
        return this.sharedWithOrgs ? this.sharedWithOrgs.includes(targetOrgId) : false;
      };
      entity.addSharedOrg = function (
        this: EntityRecord & { sharedWithOrgs?: string[] },
        targetOrgId: string
      ) {
        if (!this.sharedWithOrgs) {
          this.sharedWithOrgs = [];
        }
        if (!this.sharedWithOrgs.includes(targetOrgId)) {
          this.sharedWithOrgs.push(targetOrgId);
        }
      };
      entity.removeSharedOrg = function (
        this: EntityRecord & { sharedWithOrgs?: string[] },
        targetOrgId: string
      ) {
        if (!this.sharedWithOrgs) {
          return;
        }
        this.sharedWithOrgs = this.sharedWithOrgs.filter((id: string) => id !== targetOrgId);
      };
      entity.isOwnedBy = function (
        this: EntityRecord & { organizationId?: string },
        organizationId: string
      ) {
        return this.organizationId === organizationId;
      };
      return entity;
    }),
    update: jest
      .fn()
      .mockImplementation(
        async (
          criteria: string | Record<string, unknown>,
          partialEntity: Partial<EntityRecord>
        ) => {
          let affected = 0;
          if (typeof criteria === 'string') {
            const entity = storage.get(criteria);
            if (entity) {
              Object.assign(entity, partialEntity);
              affected = 1;
            }
          } else if (typeof criteria === 'object') {
            Array.from(storage.values()).forEach((entity: EntityRecord) => {
              const matches = Object.entries(criteria).every(
                ([key, value]) => entity[key] === value
              );
              if (matches) {
                Object.assign(entity, partialEntity);
                affected++;
              }
            });
          }
          return { affected, raw: {} };
        }
      ),
    delete: jest.fn().mockImplementation(async (criteria: string | Record<string, unknown>) => {
      let affected = 0;
      if (typeof criteria === 'string') {
        if (storage.has(criteria)) {
          storage.delete(criteria);
          affected = 1;
        }
      } else if (typeof criteria === 'object') {
        const toDelete: string[] = [];
        storage.forEach((entity: EntityRecord, id: string) => {
          const matches = Object.entries(criteria).every(([key, value]) => {
            // Handle array values (IN clause)
            if (Array.isArray(value)) {
              return value.includes(entity[key]);
            }
            return entity[key] === value;
          });
          if (matches) {
            toDelete.push(id);
          }
        });
        toDelete.forEach(id => storage.delete(id));
        affected = toDelete.length;
      }
      return { affected, raw: {} };
    }),
    remove: jest.fn().mockImplementation(async (entity: EntityRecord) => {
      if (entity.id && storage.has(entity.id)) {
        storage.delete(entity.id);
      }
      return entity;
    }),
    createQueryBuilder: jest
      .fn()
      .mockImplementation(() => createMockQueryBuilder<T>(entityName, storage)),
    count: jest.fn().mockImplementation(async (options?: FindOptions) => {
      if (!options?.where) {
        return storage.size;
      }
      const results = await mockRepository(entityName).find(options);
      return results.length;
    }),
    metadata: {
      name: entityName,
      tableName: entityName.toLowerCase(),
      targetName: entityName,
      columns: [],
      relations: [],
      primaryColumns: [{ propertyName: 'id', databaseName: 'id' }],
    },
    manager: {},
    target: entityName,
  } as unknown as Repository<T>;
}

// Shared state for controlling mock behavior across tests
export const mockDataSourceState = {
  isInitialized: true,
};

type EntityTarget<T> = Function | string;

export function mockDataSource() {
  const repositoryMap = new Map<string, Repository<ObjectLiteral>>();

  // Create mock query runner
  const mockQueryRunner = {
    connect: jest.fn().mockResolvedValue(undefined),
    startTransaction: jest.fn().mockResolvedValue(undefined),
    commitTransaction: jest.fn().mockResolvedValue(undefined),
    rollbackTransaction: jest.fn().mockResolvedValue(undefined),
    release: jest.fn().mockResolvedValue(undefined),
    manager: {
      save: jest.fn().mockImplementation(async (entity: EntityRecord) => {
        // Detect entity type from entity name or prototype
        const entityName = entity.constructor.name;
        const repo = mockRepository(entityName);
        return await repo.save(entity);
      }),
      getRepository: jest.fn().mockImplementation((target: EntityTarget<ObjectLiteral>) => {
        const entityName = typeof target === 'string' ? target : target.name;
        if (!repositoryMap.has(entityName)) {
          repositoryMap.set(entityName, mockRepository(entityName));
        }
        return repositoryMap.get(entityName);
      }),
    },
  };

  const dataSource = {
    getRepository: jest.fn().mockImplementation((target: EntityTarget<ObjectLiteral>) => {
      const entityName = typeof target === 'string' ? target : target.name;
      if (!repositoryMap.has(entityName)) {
        repositoryMap.set(entityName, mockRepository(entityName));
      }
      return repositoryMap.get(entityName);
    }),
    getMetadata: jest.fn().mockImplementation((target: EntityTarget<ObjectLiteral>) => {
      const entityName = typeof target === 'string' ? target : target.name;
      return {
        name: entityName,
        tableName: entityName.toLowerCase(),
        targetName: entityName,
        columns: [],
        relations: [],
        primaryColumns: [{ propertyName: 'id', databaseName: 'id' }],
      };
    }),
    createQueryRunner: jest.fn().mockReturnValue(mockQueryRunner),
    initialize: jest.fn().mockResolvedValue(undefined),
    destroy: jest.fn().mockImplementation(async () => {
      // Clear storage on destroy
      clearEntityStorage();
      return undefined;
    }),
    transaction: jest
      .fn()
      .mockImplementation(async (cb: (entityManager: unknown) => Promise<unknown>) => {
        const entityManager = {
          save: jest.fn().mockImplementation(async (entity: EntityRecord) => {
            const entityName = entity.constructor.name;
            const repo = mockRepository(entityName);
            return await repo.save(entity);
          }),
          getRepository: jest.fn().mockImplementation((target: EntityTarget<ObjectLiteral>) => {
            const entityName = typeof target === 'string' ? target : target.name;
            if (!repositoryMap.has(entityName)) {
              repositoryMap.set(entityName, mockRepository(entityName));
            }
            return repositoryMap.get(entityName);
          }),
        };
        return await cb(entityManager);
      }),
    query: jest.fn().mockResolvedValue([]),
    manager: {
      getRepository: jest.fn().mockImplementation((target: EntityTarget<ObjectLiteral>) => {
        const entityName = typeof target === 'string' ? target : target.name;
        if (!repositoryMap.has(entityName)) {
          repositoryMap.set(entityName, mockRepository(entityName));
        }
        return repositoryMap.get(entityName);
      }),
      find: jest
        .fn()
        .mockImplementation(
          async (entityClass: EntityTarget<ObjectLiteral>, options?: FindOptions) => {
            const entityName = typeof entityClass === 'string' ? entityClass : entityClass.name;
            const repo = mockRepository(entityName);
            return await repo.find(options);
          }
        ),
      save: jest.fn().mockImplementation(async (entity: EntityRecord) => {
        const entityName = entity.constructor.name;
        const repo = mockRepository(entityName);
        return await repo.save(entity);
      }),
      transaction: jest
        .fn()
        .mockImplementation(async (cb: (entityManager: unknown) => Promise<unknown>) => {
          const entityManager = {
            save: jest.fn().mockImplementation(async (entity: EntityRecord) => {
              const entityName = entity.constructor.name;
              const repo = mockRepository(entityName);
              return await repo.save(entity);
            }),
          };
          return await cb(entityManager);
        }),
    },
    options: { type: 'postgres', database: 'test' },
  } as unknown as DataSource;

  // Use Object.defineProperty to make isInitialized dynamically reference the shared state
  Object.defineProperty(dataSource, 'isInitialized', {
    get() {
      return mockDataSourceState.isInitialized;
    },
    set(value: boolean) {
      mockDataSourceState.isInitialized = value;
    },
    enumerable: true,
    configurable: true,
  });

  return dataSource;
}

export const mockAppDataSource = mockDataSource();
