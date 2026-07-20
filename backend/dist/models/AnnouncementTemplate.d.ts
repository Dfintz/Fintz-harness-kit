import { AnnouncementEmbedConfig } from './Announcement';
import { Organization } from './Organization';
export declare class AnnouncementTemplate {
    id: string;
    organizationId?: string;
    organization?: Organization;
    name: string;
    title?: string;
    content: string;
    embedConfig?: AnnouncementEmbedConfig;
    isGlobal: boolean;
    createdBy: string;
    createdByName?: string;
    createdAt: Date;
    updatedAt: Date;
    deletedAt?: Date;
    deletedBy?: string;
    isAvailableTo(organizationId: string): boolean;
    canBeModifiedBy(userId: string, isPlatformAdmin: boolean): boolean;
}
//# sourceMappingURL=AnnouncementTemplate.d.ts.map