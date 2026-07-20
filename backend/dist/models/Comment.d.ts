import { TenantEntity } from './base/TenantEntity';
import { CommentLike } from './CommentLike';
export declare class Comment extends TenantEntity {
    id: string;
    content: string;
    resourceType: string;
    resourceId: string;
    createdBy: string;
    createdByName?: string;
    parentId?: string;
    parent?: Comment;
    replies?: Comment[];
    likes?: CommentLike[];
    isEdited: boolean;
    editedAt?: Date;
    likeCount: number;
    replyCount: number;
    createdAt: Date;
    updatedAt: Date;
}
//# sourceMappingURL=Comment.d.ts.map