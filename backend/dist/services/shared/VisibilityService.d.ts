export interface RedactedEntity {
    id: string;
    name: string;
    isPublic: false;
    isRedacted: true;
}
interface VisibleEntity {
    id: string;
    isPublic?: boolean;
}
export declare class VisibilityService {
    canViewFull(entityId: string, isPublic: boolean, _viewerId: string, viewerMembershipIds: string[], isPlatformAdmin?: boolean): boolean;
    redactForViewer<T extends VisibleEntity>(entities: T[], viewerId: string, viewerMembershipIds: string[], isPlatformAdmin?: boolean, entityType?: 'organization' | 'alliance'): Array<T | RedactedEntity>;
}
export {};
//# sourceMappingURL=VisibilityService.d.ts.map