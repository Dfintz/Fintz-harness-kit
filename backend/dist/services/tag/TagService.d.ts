import { Tag } from '../../models/Tag';
import { TagAssignment } from '../../models/TagAssignment';
export declare class TagService {
    private readonly tagRepository;
    private readonly assignmentRepository;
    listTags(organizationId: string, filters?: {
        search?: string;
        limit?: number;
    }): Promise<Tag[]>;
    getTag(organizationId: string, tagId: string): Promise<Tag | null>;
    createTag(organizationId: string, userId: string, data: {
        name: string;
        color?: string;
        description?: string;
    }): Promise<Tag>;
    updateTag(organizationId: string, tagId: string, data: {
        name?: string;
        color?: string;
        description?: string;
    }): Promise<Tag>;
    deleteTag(organizationId: string, tagId: string): Promise<void>;
    applyTag(organizationId: string, userId: string, tagId: string, resourceType: string, resourceId: string): Promise<TagAssignment>;
    removeTag(organizationId: string, tagId: string, resourceType: string, resourceId: string): Promise<void>;
    getPopularTags(organizationId: string, limit?: number): Promise<Array<{
        tag: Tag;
        usageCount: number;
    }>>;
}
//# sourceMappingURL=TagService.d.ts.map