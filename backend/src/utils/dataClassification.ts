/**
 * Data Classification System (ZT-12)
 *
 * Provides decorators and utilities for classifying data sensitivity levels.
 * Used to enforce access controls, audit logging, and encryption requirements.
 *
 * Classification Levels:
 * - PUBLIC: No restrictions (ship names, fleet names, activity titles)
 * - INTERNAL: Business data not for external exposure (usernames, org names, membership)
 * - CONFIDENTIAL: PII and sensitive identifiers (email, IP, Discord ID, RSI handle)
 * - RESTRICTED: Secrets that must never be logged or exposed (passwords, tokens, keys)
 */

/**
 * Data sensitivity levels in ascending order of restriction
 */
export enum DataClassification {
  /** No restrictions - publicly visible data */
  PUBLIC = 'PUBLIC',
  /** Internal business data - not for external exposure */
  INTERNAL = 'INTERNAL',
  /** PII and sensitive identifiers - requires access controls */
  CONFIDENTIAL = 'CONFIDENTIAL',
  /** Secrets and credentials - must never be logged or exposed */
  RESTRICTED = 'RESTRICTED',
}

/**
 * Metadata about a classified field
 */
export interface ClassifiedFieldInfo {
  /** The entity class name */
  entity: string;
  /** The property/column name */
  field: string;
  /** The classification level */
  classification: DataClassification;
  /** Whether this field should be masked in logs */
  maskInLogs: boolean;
  /** Whether this field requires encryption at rest */
  requiresEncryption: boolean;
  /** Human-readable description of why this classification was chosen */
  reason?: string;
}

/**
 * Registry of all classified fields across all entities
 */
class DataClassificationRegistry {
  private fields: ClassifiedFieldInfo[] = [];

  register(info: ClassifiedFieldInfo): void {
    this.fields.push(info);
  }

  /**
   * Get all classified fields
   */
  getAll(): ReadonlyArray<ClassifiedFieldInfo> {
    return this.fields;
  }

  /**
   * Get classified fields for a specific entity
   */
  getForEntity(entityName: string): ClassifiedFieldInfo[] {
    return this.fields.filter(f => f.entity === entityName);
  }

  /**
   * Get all fields at or above a given classification level
   */
  getAtLevel(minLevel: DataClassification): ClassifiedFieldInfo[] {
    const levels = [
      DataClassification.PUBLIC,
      DataClassification.INTERNAL,
      DataClassification.CONFIDENTIAL,
      DataClassification.RESTRICTED,
    ];
    const minIndex = levels.indexOf(minLevel);
    return this.fields.filter(f => levels.indexOf(f.classification) >= minIndex);
  }

  /**
   * Get all fields that must be masked in logs
   */
  getLogMaskedFields(): ClassifiedFieldInfo[] {
    return this.fields.filter(f => f.maskInLogs);
  }

  /**
   * Get all fields that require encryption at rest
   */
  getEncryptionRequired(): ClassifiedFieldInfo[] {
    return this.fields.filter(f => f.requiresEncryption);
  }

  /**
   * Check if a specific field on an entity is classified at or above a level
   */
  isAtLeast(entityName: string, fieldName: string, level: DataClassification): boolean {
    const levels = [
      DataClassification.PUBLIC,
      DataClassification.INTERNAL,
      DataClassification.CONFIDENTIAL,
      DataClassification.RESTRICTED,
    ];
    const field = this.fields.find(f => f.entity === entityName && f.field === fieldName);
    if (!field) {return false;}
    return levels.indexOf(field.classification) >= levels.indexOf(level);
  }

  /**
   * Get a summary of classifications by entity (useful for compliance reports)
   */
  getSummary(): Record<string, Record<DataClassification, string[]>> {
    const summary: Record<string, Record<DataClassification, string[]>> = {};
    for (const field of this.fields) {
      if (!summary[field.entity]) {
        summary[field.entity] = {
          [DataClassification.PUBLIC]: [],
          [DataClassification.INTERNAL]: [],
          [DataClassification.CONFIDENTIAL]: [],
          [DataClassification.RESTRICTED]: [],
        };
      }
      summary[field.entity][field.classification].push(field.field);
    }
    return summary;
  }
}

/** Singleton registry instance */
export const dataClassificationRegistry = new DataClassificationRegistry();

/**
 * Options for the @Classified decorator
 */
interface ClassifiedOptions {
  /** Override automatic log masking (default: true for CONFIDENTIAL+) */
  maskInLogs?: boolean;
  /** Override automatic encryption requirement (default: true for RESTRICTED) */
  requiresEncryption?: boolean;
  /** Human-readable reason for this classification */
  reason?: string;
}

/**
 * Property decorator that classifies a field's data sensitivity level.
 *
 * @example
 * ```typescript
 * @Entity('users')
 * class User {
 *   @Classified(DataClassification.CONFIDENTIAL, { reason: 'PII - email address' })
 *   @Column()
 *   email!: string;
 *
 *   @Classified(DataClassification.RESTRICTED, { reason: 'Authentication credential' })
 *   @Column({ select: false })
 *   password!: string;
 * }
 * ```
 */
export function Classified(
  classification: DataClassification,
  options?: ClassifiedOptions
): PropertyDecorator {
  return (target: object, propertyKey: string | symbol): void => {
    const entityName = target.constructor.name;
    const fieldName = String(propertyKey);

    // Default masking: CONFIDENTIAL and above are masked in logs
    const maskInLogs = options?.maskInLogs ??
      (classification === DataClassification.CONFIDENTIAL || classification === DataClassification.RESTRICTED);

    // Default encryption: RESTRICTED fields require encryption
    const requiresEncryption = options?.requiresEncryption ??
      (classification === DataClassification.RESTRICTED);

    dataClassificationRegistry.register({
      entity: entityName,
      field: fieldName,
      classification,
      maskInLogs,
      requiresEncryption,
      reason: options?.reason,
    });
  };
}

/**
 * Utility: Mask sensitive fields in an object based on classification registry.
 * Useful for sanitizing objects before logging.
 *
 * @param entityName - The entity class name
 * @param data - The data object to mask
 * @returns A new object with sensitive fields masked
 */
export function maskSensitiveFields(
  entityName: string,
  data: Record<string, unknown>
): Record<string, unknown> {
  const maskedFields = dataClassificationRegistry.getForEntity(entityName)
    .filter(f => f.maskInLogs)
    .map(f => f.field);

  if (maskedFields.length === 0) {return data;}

  const masked = { ...data };
  for (const field of maskedFields) {
    if (field in masked && masked[field] !== undefined && masked[field] !== null) {
      const value = String(masked[field]);
      if (value.length <= 4) {
        masked[field] = '***';
      } else {
        masked[field] = `${value.substring(0, 2)}***${value.substring(value.length - 2)}`;
      }
    }
  }
  return masked;
}
