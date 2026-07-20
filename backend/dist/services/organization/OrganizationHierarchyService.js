"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrganizationHierarchyService = void 0;
const node_crypto_1 = require("node:crypto");
const typeorm_1 = require("typeorm");
const data_source_1 = require("../../data-source");
const Organization_1 = require("../../models/Organization");
class OrganizationHierarchyService {
    organizationRepository = data_source_1.AppDataSource.getRepository(Organization_1.Organization);
    MAX_DEPTH = 10;
    async createSubOrganization(parentId, orgData) {
        const parent = await this.organizationRepository.findOne({
            where: { id: parentId },
        });
        if (!parent) {
            throw new Error('Parent organization not found');
        }
        if (parent.settings?.allowSubOrgs === false) {
            throw new Error('Parent organization does not allow sub-organizations');
        }
        const newLevel = parent.level + 1;
        if (newLevel > this.MAX_DEPTH) {
            throw new Error(`Maximum hierarchy depth (${this.MAX_DEPTH}) exceeded`);
        }
        if (parent.settings?.maxDepth && newLevel > parent.settings.maxDepth) {
            throw new Error(`Parent organization max depth (${parent.settings.maxDepth}) exceeded`);
        }
        const type = this.determineTypeByLevel(newLevel);
        const orgId = orgData.id || (0, node_crypto_1.randomUUID)();
        const newOrg = this.organizationRepository.create({
            ...orgData,
            id: orgId,
            parentOrgId: parentId,
            level: newLevel,
            path: `${parent.buildPath(parent.path)}.${orgData.id || ''}`,
            rootOrgId: parent.rootOrgId || parent.id,
            type: orgData.type || type,
            status: orgData.status || Organization_1.OrganizationStatus.ACTIVE,
        });
        const saved = await this.organizationRepository.save(newOrg);
        saved.path = parent.path ? `${parent.path}.${saved.id}` : saved.id;
        await this.organizationRepository.save(saved);
        await this.updateChildCount(parentId);
        return saved;
    }
    determineTypeByLevel(level) {
        if (level === 0) {
            return Organization_1.OrganizationType.ROOT;
        }
        if (level === 1) {
            return Organization_1.OrganizationType.DIVISION;
        }
        if (level === 2) {
            return Organization_1.OrganizationType.DEPARTMENT;
        }
        return Organization_1.OrganizationType.TEAM;
    }
    async getAncestors(orgId) {
        const org = await this.organizationRepository.findOne({
            where: { id: orgId },
        });
        if (!org) {
            throw new Error('Organization not found');
        }
        const ancestorIds = org.getAncestorIds();
        if (ancestorIds.length === 0) {
            return [];
        }
        const ancestors = await this.organizationRepository.find({
            where: { id: (0, typeorm_1.In)(ancestorIds) },
            order: { level: 'ASC' },
        });
        return ancestors;
    }
    async getDescendants(orgId, maxDepth) {
        const org = await this.organizationRepository.findOne({
            where: { id: orgId },
        });
        if (!org) {
            throw new Error('Organization not found');
        }
        const queryBuilder = this.organizationRepository
            .createQueryBuilder('org')
            .where('org.path LIKE :path', { path: `${org.path}.%` })
            .orderBy('org.level', 'ASC')
            .addOrderBy('org.name', 'ASC');
        if (maxDepth !== undefined) {
            queryBuilder.andWhere('org.level <= :maxLevel', {
                maxLevel: org.level + maxDepth,
            });
        }
        return queryBuilder.getMany();
    }
    async getChildren(orgId) {
        return this.organizationRepository.find({
            where: { parentOrgId: orgId },
            order: { name: 'ASC' },
        });
    }
    async getRoot(orgId) {
        const org = await this.organizationRepository.findOne({
            where: { id: orgId },
        });
        if (!org) {
            throw new Error('Organization not found');
        }
        if (org.isRoot()) {
            return org;
        }
        const root = await this.organizationRepository.findOne({
            where: { id: org.rootOrgId },
        });
        if (!root) {
            throw new Error('Root organization not found');
        }
        return root;
    }
    async getRootOrganizations() {
        return this.organizationRepository.find({
            where: { parentOrgId: (0, typeorm_1.IsNull)() },
            order: { name: 'ASC' },
        });
    }
    async getSiblings(orgId, includeSelf = false) {
        const org = await this.organizationRepository.findOne({
            where: { id: orgId },
        });
        if (!org) {
            throw new Error('Organization not found');
        }
        if (!org.parentOrgId) {
            return [];
        }
        const queryBuilder = this.organizationRepository
            .createQueryBuilder('org')
            .where('org.parentOrgId = :parentId', { parentId: org.parentOrgId });
        if (!includeSelf) {
            queryBuilder.andWhere('org.id != :orgId', { orgId });
        }
        return queryBuilder.orderBy('org.name', 'ASC').getMany();
    }
    async getTree(rootId) {
        const root = await this.organizationRepository.findOne({
            where: { id: rootId },
        });
        if (!root) {
            throw new Error('Organization not found');
        }
        const descendants = await this.getDescendants(rootId);
        return this.buildTree(root, descendants);
    }
    buildTree(root, allOrgs) {
        const orgMap = new Map();
        orgMap.set(root.id, { ...root, children: [] });
        for (const org of allOrgs) {
            orgMap.set(org.id, { ...org, children: [] });
        }
        for (const org of allOrgs) {
            if (org.parentOrgId) {
                const parent = orgMap.get(org.parentOrgId);
                const child = orgMap.get(org.id);
                if (parent && child) {
                    parent.children.push(child);
                }
            }
        }
        return orgMap.get(root.id);
    }
    async moveOrganization(orgId, newParentId) {
        const org = await this.organizationRepository.findOne({
            where: { id: orgId },
        });
        if (!org) {
            throw new Error('Organization not found');
        }
        if (orgId === newParentId) {
            throw new Error('Cannot move organization to itself');
        }
        if (newParentId && org.isAncestorOf(newParentId)) {
            throw new Error('Cannot move organization to its own descendant');
        }
        let newParent = null;
        let newLevel = 0;
        let newPath = org.id;
        let newRootId = org.id;
        if (newParentId) {
            newParent = await this.organizationRepository.findOne({
                where: { id: newParentId },
            });
            if (!newParent) {
                throw new Error('New parent organization not found');
            }
            if (newParent.settings?.allowSubOrgs === false) {
                throw new Error('Parent organization does not allow sub-organizations');
            }
            newLevel = newParent.level + 1;
            newPath = `${newParent.path}.${org.id}`;
            newRootId = newParent.rootOrgId || newParent.id;
            const descendants = await this.getDescendants(orgId);
            const maxDescendantLevel = descendants.reduce((max, d) => Math.max(max, d.level), org.level);
            const descendantDepth = maxDescendantLevel - org.level;
            const newMaxLevel = newLevel + descendantDepth;
            if (newMaxLevel > this.MAX_DEPTH) {
                throw new Error(`Move would exceed maximum hierarchy depth (${this.MAX_DEPTH})`);
            }
        }
        const oldParentId = org.parentOrgId;
        const levelDifference = newLevel - org.level;
        org.parentOrgId = newParentId || undefined;
        org.level = newLevel;
        org.path = newPath;
        org.rootOrgId = newRootId;
        org.type = this.determineTypeByLevel(newLevel);
        await this.organizationRepository.save(org);
        if (levelDifference !== 0) {
            await this.updateDescendantPaths(orgId, newPath, levelDifference);
        }
        if (oldParentId) {
            await this.updateChildCount(oldParentId);
        }
        if (newParentId) {
            await this.updateChildCount(newParentId);
        }
        return org;
    }
    async detachFromParent(orgId) {
        return this.moveOrganization(orgId, null);
    }
    async deleteOrganization(orgId, deleteDescendants = false) {
        const org = await this.organizationRepository.findOne({
            where: { id: orgId },
        });
        if (!org) {
            throw new Error('Organization not found');
        }
        if (deleteDescendants) {
            const descendants = await this.getDescendants(orgId);
            const idsToDelete = [orgId, ...descendants.map(d => d.id)];
            await this.organizationRepository.delete({ id: (0, typeorm_1.In)(idsToDelete) });
        }
        else {
            const children = await this.getChildren(orgId);
            for (const child of children) {
                await this.moveOrganization(child.id, org.parentOrgId || null);
            }
            await this.organizationRepository.delete({ id: orgId });
        }
        if (org.parentOrgId) {
            await this.updateChildCount(org.parentOrgId);
        }
    }
    async updateDescendantPaths(orgId, newParentPath, levelDifference) {
        const descendants = await this.getDescendants(orgId);
        for (const descendant of descendants) {
            const pathParts = descendant.path.split('.');
            const orgIndex = pathParts.indexOf(orgId);
            if (orgIndex !== -1) {
                const newPathParts = [...newParentPath.split('.'), ...pathParts.slice(orgIndex + 1)];
                descendant.path = newPathParts.join('.');
            }
            descendant.level += levelDifference;
            descendant.type = this.determineTypeByLevel(descendant.level);
            await this.organizationRepository.save(descendant);
        }
    }
    async updateChildCount(orgId) {
        const children = await this.getChildren(orgId);
        await this.organizationRepository.update({ id: orgId }, { childCount: children.length });
    }
    async validateHierarchy(orgId) {
        const errors = [];
        try {
            const org = await this.organizationRepository.findOne({
                where: { id: orgId },
            });
            if (!org) {
                return { valid: false, errors: ['Organization not found'] };
            }
            if (org.parentOrgId) {
                const parent = await this.organizationRepository.findOne({
                    where: { id: org.parentOrgId },
                });
                if (!parent) {
                    errors.push('Parent organization not found');
                }
            }
            const pathParts = org.path.split('.');
            if (pathParts.length - 1 !== org.level) {
                errors.push(`Level (${org.level}) does not match path depth (${pathParts.length - 1})`);
            }
            const ancestors = await this.getAncestors(orgId);
            const ancestorIds = ancestors.map(a => a.id);
            if (ancestorIds.includes(orgId)) {
                errors.push('Circular reference detected in hierarchy');
            }
            if (org.level > this.MAX_DEPTH) {
                errors.push(`Organization exceeds maximum depth (${this.MAX_DEPTH})`);
            }
            if (!org.isRoot() && !org.rootOrgId) {
                errors.push('Non-root organization missing rootOrgId');
            }
            const actualChildren = await this.getChildren(orgId);
            if (actualChildren.length !== org.childCount) {
                errors.push(`Child count mismatch: stored=${org.childCount}, actual=${actualChildren.length}`);
            }
        }
        catch (error) {
            errors.push(`Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
        return {
            valid: errors.length === 0,
            errors,
        };
    }
    async repairHierarchy(orgId) {
        const fixes = [];
        const org = await this.organizationRepository.findOne({
            where: { id: orgId },
        });
        if (!org) {
            return { repaired: false, fixes: ['Organization not found'] };
        }
        const actualChildren = await this.getChildren(orgId);
        if (actualChildren.length !== org.childCount) {
            org.childCount = actualChildren.length;
            fixes.push(`Updated child count to ${actualChildren.length}`);
        }
        if (org.parentOrgId) {
            const parent = await this.organizationRepository.findOne({
                where: { id: org.parentOrgId },
            });
            if (parent) {
                const correctPath = `${parent.path}.${org.id}`;
                if (org.path !== correctPath) {
                    org.path = correctPath;
                    fixes.push(`Updated path to ${correctPath}`);
                }
                const correctLevel = parent.level + 1;
                if (org.level !== correctLevel) {
                    org.level = correctLevel;
                    fixes.push(`Updated level to ${correctLevel}`);
                }
            }
        }
        else {
            if (org.path !== org.id) {
                org.path = org.id;
                fixes.push('Updated root path');
            }
            if (org.level !== 0) {
                org.level = 0;
                fixes.push('Updated root level to 0');
            }
        }
        if (fixes.length > 0) {
            await this.organizationRepository.save(org);
        }
        return {
            repaired: fixes.length > 0,
            fixes,
        };
    }
    async getHierarchyStats(orgId) {
        const org = await this.organizationRepository.findOne({
            where: { id: orgId },
        });
        if (!org) {
            throw new Error('Organization not found');
        }
        const descendants = await this.getDescendants(orgId);
        const children = await this.getChildren(orgId);
        const maxLevel = descendants.reduce((max, d) => Math.max(max, d.level), org.level);
        const depth = maxLevel - org.level;
        const organizationsByLevel = {};
        for (const descendant of descendants) {
            organizationsByLevel[descendant.level] = (organizationsByLevel[descendant.level] || 0) + 1;
        }
        const totalMembers = descendants.reduce((sum, d) => sum + (d.totalMembers || 0), org.totalMembers || 0);
        return {
            depth,
            totalDescendants: descendants.length,
            directChildren: children.length,
            totalMembers,
            organizationsByLevel,
        };
    }
}
exports.OrganizationHierarchyService = OrganizationHierarchyService;
//# sourceMappingURL=OrganizationHierarchyService.js.map