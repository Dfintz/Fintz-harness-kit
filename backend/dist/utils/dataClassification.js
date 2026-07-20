"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dataClassificationRegistry = exports.DataClassification = void 0;
exports.Classified = Classified;
exports.maskSensitiveFields = maskSensitiveFields;
var DataClassification;
(function (DataClassification) {
    DataClassification["PUBLIC"] = "PUBLIC";
    DataClassification["INTERNAL"] = "INTERNAL";
    DataClassification["CONFIDENTIAL"] = "CONFIDENTIAL";
    DataClassification["RESTRICTED"] = "RESTRICTED";
})(DataClassification || (exports.DataClassification = DataClassification = {}));
class DataClassificationRegistry {
    fields = [];
    register(info) {
        this.fields.push(info);
    }
    getAll() {
        return this.fields;
    }
    getForEntity(entityName) {
        return this.fields.filter(f => f.entity === entityName);
    }
    getAtLevel(minLevel) {
        const levels = [
            DataClassification.PUBLIC,
            DataClassification.INTERNAL,
            DataClassification.CONFIDENTIAL,
            DataClassification.RESTRICTED,
        ];
        const minIndex = levels.indexOf(minLevel);
        return this.fields.filter(f => levels.indexOf(f.classification) >= minIndex);
    }
    getLogMaskedFields() {
        return this.fields.filter(f => f.maskInLogs);
    }
    getEncryptionRequired() {
        return this.fields.filter(f => f.requiresEncryption);
    }
    isAtLeast(entityName, fieldName, level) {
        const levels = [
            DataClassification.PUBLIC,
            DataClassification.INTERNAL,
            DataClassification.CONFIDENTIAL,
            DataClassification.RESTRICTED,
        ];
        const field = this.fields.find(f => f.entity === entityName && f.field === fieldName);
        if (!field) {
            return false;
        }
        return levels.indexOf(field.classification) >= levels.indexOf(level);
    }
    getSummary() {
        const summary = {};
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
exports.dataClassificationRegistry = new DataClassificationRegistry();
function Classified(classification, options) {
    return (target, propertyKey) => {
        const entityName = target.constructor.name;
        const fieldName = String(propertyKey);
        const maskInLogs = options?.maskInLogs ??
            (classification === DataClassification.CONFIDENTIAL || classification === DataClassification.RESTRICTED);
        const requiresEncryption = options?.requiresEncryption ??
            (classification === DataClassification.RESTRICTED);
        exports.dataClassificationRegistry.register({
            entity: entityName,
            field: fieldName,
            classification,
            maskInLogs,
            requiresEncryption,
            reason: options?.reason,
        });
    };
}
function maskSensitiveFields(entityName, data) {
    const maskedFields = exports.dataClassificationRegistry.getForEntity(entityName)
        .filter(f => f.maskInLogs)
        .map(f => f.field);
    if (maskedFields.length === 0) {
        return data;
    }
    const masked = { ...data };
    for (const field of maskedFields) {
        if (field in masked && masked[field] !== undefined && masked[field] !== null) {
            const value = String(masked[field]);
            if (value.length <= 4) {
                masked[field] = '***';
            }
            else {
                masked[field] = `${value.substring(0, 2)}***${value.substring(value.length - 2)}`;
            }
        }
    }
    return masked;
}
//# sourceMappingURL=dataClassification.js.map