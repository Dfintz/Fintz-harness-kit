"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VisibilityService = void 0;
const logger_1 = require("../../utils/logger");
class VisibilityService {
    canViewFull(entityId, isPublic, _viewerId, viewerMembershipIds, isPlatformAdmin = false) {
        if (isPublic) {
            return true;
        }
        if (isPlatformAdmin) {
            return true;
        }
        if (viewerMembershipIds.includes(entityId)) {
            return true;
        }
        return false;
    }
    redactForViewer(entities, viewerId, viewerMembershipIds, isPlatformAdmin = false, entityType = 'organization') {
        const redactedLabel = entityType === 'organization' ? 'Private Organization' : 'Private Alliance';
        return entities.map(entity => {
            const canView = this.canViewFull(entity.id, entity.isPublic ?? false, viewerId, viewerMembershipIds, isPlatformAdmin);
            if (canView) {
                return entity;
            }
            logger_1.logger.debug(`Redacting ${entityType} ${entity.id} for viewer ${viewerId}`);
            return {
                id: entity.id,
                name: redactedLabel,
                isPublic: false,
                isRedacted: true,
            };
        });
    }
}
exports.VisibilityService = VisibilityService;
//# sourceMappingURL=VisibilityService.js.map