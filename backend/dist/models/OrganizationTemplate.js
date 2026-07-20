"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrganizationTemplate = exports.TemplateVisibility = exports.TemplateCategory = void 0;
const typeorm_1 = require("typeorm");
var TemplateCategory;
(function (TemplateCategory) {
    TemplateCategory["MILITARY"] = "MILITARY";
    TemplateCategory["CORPORATE"] = "CORPORATE";
    TemplateCategory["GUILD"] = "GUILD";
    TemplateCategory["COMMUNITY"] = "COMMUNITY";
    TemplateCategory["PROJECT"] = "PROJECT";
    TemplateCategory["CUSTOM"] = "CUSTOM";
})(TemplateCategory || (exports.TemplateCategory = TemplateCategory = {}));
var TemplateVisibility;
(function (TemplateVisibility) {
    TemplateVisibility["PUBLIC"] = "PUBLIC";
    TemplateVisibility["PRIVATE"] = "PRIVATE";
    TemplateVisibility["ORGANIZATION"] = "ORGANIZATION";
    TemplateVisibility["MARKETPLACE"] = "MARKETPLACE";
})(TemplateVisibility || (exports.TemplateVisibility = TemplateVisibility = {}));
let OrganizationTemplate = class OrganizationTemplate {
    id;
    name;
    description;
    category;
    visibility;
    createdBy;
    creatorName;
    structure;
    defaultRoles;
    defaultPermissions;
    defaultSettings;
    applicationConfig;
    tags;
    iconUrl;
    usageCount;
    averageRating;
    ratingCount;
    isActive;
    isFeatured;
    isVerified;
    isPublic;
    get creatorId() {
        return this.createdBy;
    }
    set creatorId(value) {
        this.createdBy = value;
    }
    version;
    changelog;
    forkedFrom;
    sourceTemplate;
    preview;
    metadata;
    createdAt;
    updatedAt;
    lastUsedAt;
    getMaxDepth() {
        const calculateDepth = (node, currentDepth = 0) => {
            if (!node.children || node.children.length === 0) {
                return currentDepth;
            }
            return Math.max(...node.children.map(child => calculateDepth(child, currentDepth + 1)));
        };
        return calculateDepth(this.structure);
    }
    getNodeCount() {
        const countNodes = (node) => {
            if (!node.children || node.children.length === 0) {
                return 1;
            }
            return 1 + node.children.reduce((sum, child) => sum + countNodes(child), 0);
        };
        return countNodes(this.structure);
    }
    getAllRoles() {
        const roles = new Set();
        this.defaultRoles.forEach(role => roles.add(role.name));
        const extractRoles = (node) => {
            if (node.defaultRoles) {
                node.defaultRoles.forEach(role => roles.add(role));
            }
            if (node.children) {
                node.children.forEach(child => extractRoles(child));
            }
        };
        extractRoles(this.structure);
        return Array.from(roles);
    }
    validateStructure() {
        const errors = [];
        if (!this.structure.name) {
            errors.push('Root structure must have a name');
        }
        const maxDepth = this.getMaxDepth();
        if (maxDepth > 10) {
            errors.push(`Template depth ${maxDepth} exceeds maximum of 10`);
        }
        const validateNode = (node, path) => {
            if (!node.name) {
                errors.push(`Node at ${path} is missing a name`);
            }
            if (node.children) {
                node.children.forEach((child, index) => {
                    validateNode(child, `${path}/${child.name || index}`);
                });
            }
        };
        validateNode(this.structure, 'root');
        this.defaultRoles.forEach((role, index) => {
            if (!role.name) {
                errors.push(`Role at index ${index} is missing a name`);
            }
            if (!role.permissions || role.permissions.length === 0) {
                errors.push(`Role "${role.name}" has no permissions`);
            }
        });
        return {
            valid: errors.length === 0,
            errors,
        };
    }
    getSummary() {
        return {
            id: this.id,
            name: this.name,
            description: this.description,
            category: this.category,
            visibility: this.visibility,
            iconUrl: this.iconUrl,
            usageCount: this.usageCount,
            averageRating: this.averageRating,
            ratingCount: this.ratingCount,
            isFeatured: this.isFeatured,
            isVerified: this.isVerified,
            tags: this.tags,
            maxDepth: this.getMaxDepth(),
            nodeCount: this.getNodeCount(),
            roleCount: this.defaultRoles.length,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt,
        };
    }
    incrementUsage() {
        this.usageCount += 1;
        this.lastUsedAt = new Date();
    }
    addRating(rating) {
        const totalRating = this.averageRating * this.ratingCount + rating;
        this.ratingCount += 1;
        this.averageRating = totalRating / this.ratingCount;
    }
    fork(newName, userId) {
        return {
            name: newName,
            description: `Forked from ${this.name}`,
            category: this.category,
            visibility: TemplateVisibility.PRIVATE,
            createdBy: userId,
            structure: JSON.parse(JSON.stringify(this.structure)),
            defaultRoles: JSON.parse(JSON.stringify(this.defaultRoles)),
            defaultPermissions: JSON.parse(JSON.stringify(this.defaultPermissions)),
            defaultSettings: JSON.parse(JSON.stringify(this.defaultSettings)),
            applicationConfig: JSON.parse(JSON.stringify(this.applicationConfig)),
            tags: this.tags ? [...this.tags] : null,
            forkedFrom: this.id,
            version: '1.0.0',
            metadata: { forkedFromVersion: this.version },
        };
    }
    export() {
        return {
            name: this.name,
            description: this.description,
            category: this.category,
            structure: this.structure,
            defaultRoles: this.defaultRoles,
            defaultPermissions: this.defaultPermissions,
            defaultSettings: this.defaultSettings,
            applicationConfig: this.applicationConfig,
            tags: this.tags,
            version: this.version,
            metadata: this.metadata,
        };
    }
    canBeUsedBy(userId, _userOrgId) {
        if (this.createdBy === userId) {
            return true;
        }
        switch (this.visibility) {
            case TemplateVisibility.PUBLIC:
            case TemplateVisibility.MARKETPLACE:
                return this.isActive;
            case TemplateVisibility.PRIVATE:
                return false;
            case TemplateVisibility.ORGANIZATION:
                return false;
            default:
                return false;
        }
    }
};
exports.OrganizationTemplate = OrganizationTemplate;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], OrganizationTemplate.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 100 }),
    __metadata("design:type", String)
], OrganizationTemplate.prototype, "name", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", Object)
], OrganizationTemplate.prototype, "description", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'enum',
        enum: TemplateCategory,
        default: TemplateCategory.CUSTOM,
    }),
    __metadata("design:type", String)
], OrganizationTemplate.prototype, "category", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'enum',
        enum: TemplateVisibility,
        default: TemplateVisibility.PRIVATE,
    }),
    __metadata("design:type", String)
], OrganizationTemplate.prototype, "visibility", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'uuid' }),
    __metadata("design:type", String)
], OrganizationTemplate.prototype, "createdBy", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 255, nullable: true }),
    __metadata("design:type", Object)
], OrganizationTemplate.prototype, "creatorName", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'jsonb' }),
    __metadata("design:type", Object)
], OrganizationTemplate.prototype, "structure", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'jsonb', default: [] }),
    __metadata("design:type", Array)
], OrganizationTemplate.prototype, "defaultRoles", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'jsonb', default: [] }),
    __metadata("design:type", Array)
], OrganizationTemplate.prototype, "defaultPermissions", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'jsonb' }),
    __metadata("design:type", Object)
], OrganizationTemplate.prototype, "defaultSettings", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'jsonb', default: {} }),
    __metadata("design:type", Object)
], OrganizationTemplate.prototype, "applicationConfig", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'simple-array', nullable: true }),
    __metadata("design:type", Object)
], OrganizationTemplate.prototype, "tags", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 500, nullable: true }),
    __metadata("design:type", Object)
], OrganizationTemplate.prototype, "iconUrl", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'integer', default: 0 }),
    __metadata("design:type", Number)
], OrganizationTemplate.prototype, "usageCount", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'decimal', precision: 3, scale: 2, default: 0 }),
    __metadata("design:type", Number)
], OrganizationTemplate.prototype, "averageRating", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'integer', default: 0 }),
    __metadata("design:type", Number)
], OrganizationTemplate.prototype, "ratingCount", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'boolean', default: true }),
    __metadata("design:type", Boolean)
], OrganizationTemplate.prototype, "isActive", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'boolean', default: false }),
    __metadata("design:type", Boolean)
], OrganizationTemplate.prototype, "isFeatured", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'boolean', default: false }),
    __metadata("design:type", Boolean)
], OrganizationTemplate.prototype, "isVerified", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'boolean', default: false }),
    __metadata("design:type", Boolean)
], OrganizationTemplate.prototype, "isPublic", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 20, default: '1.0.0' }),
    __metadata("design:type", String)
], OrganizationTemplate.prototype, "version", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", Object)
], OrganizationTemplate.prototype, "changelog", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], OrganizationTemplate.prototype, "forkedFrom", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => OrganizationTemplate, { nullable: true, onDelete: 'SET NULL' }),
    (0, typeorm_1.JoinColumn)({ name: 'forkedFrom' }),
    __metadata("design:type", Object)
], OrganizationTemplate.prototype, "sourceTemplate", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'jsonb', nullable: true }),
    __metadata("design:type", Object)
], OrganizationTemplate.prototype, "preview", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'jsonb', nullable: true }),
    __metadata("design:type", Object)
], OrganizationTemplate.prototype, "metadata", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], OrganizationTemplate.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)(),
    __metadata("design:type", Date)
], OrganizationTemplate.prototype, "updatedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamp', nullable: true }),
    __metadata("design:type", Object)
], OrganizationTemplate.prototype, "lastUsedAt", void 0);
exports.OrganizationTemplate = OrganizationTemplate = __decorate([
    (0, typeorm_1.Entity)('organization_templates')
], OrganizationTemplate);
//# sourceMappingURL=OrganizationTemplate.js.map