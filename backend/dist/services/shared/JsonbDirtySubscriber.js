"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.JsonbDirtySubscriber = void 0;
const typeorm_1 = require("typeorm");
const JSON_COLUMN_TYPES = new Set(['jsonb', 'json', 'simple-json', 'simple-array']);
let JsonbDirtySubscriber = class JsonbDirtySubscriber {
    afterLoad(entity, event) {
        if (entity === null || entity === undefined || typeof entity !== 'object') {
            return;
        }
        const metadata = event?.metadata;
        if (!metadata) {
            return;
        }
        const target = entity;
        for (const column of metadata.columns) {
            const columnType = typeof column.type === 'string' ? column.type : '';
            if (!JSON_COLUMN_TYPES.has(columnType)) {
                continue;
            }
            const value = target[column.propertyName];
            if (value === null || value === undefined || typeof value !== 'object') {
                continue;
            }
            target[column.propertyName] = structuredClone(value);
        }
    }
};
exports.JsonbDirtySubscriber = JsonbDirtySubscriber;
exports.JsonbDirtySubscriber = JsonbDirtySubscriber = __decorate([
    (0, typeorm_1.EventSubscriber)()
], JsonbDirtySubscriber);
//# sourceMappingURL=JsonbDirtySubscriber.js.map