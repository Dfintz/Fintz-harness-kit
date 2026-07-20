import { Comment } from '../../models/Comment';
export interface CommentListFilters {
    resourceType: string;
    resourceId: string;
    page?: number;
    limit?: number;
    sortOrder?: 'ASC' | 'DESC';
}
export declare class CommentService {
    private readonly commentRepository;
    private readonly likeRepository;
    listComments(organizationId: string, filters: CommentListFilters): Promise<{
        data: Comment[];
        total: number;
    }>;
    getComment(organizationId: string, commentId: string): Promise<Comment | null>;
    createComment(organizationId: string, userId: string, userName: string | undefined, data: {
        content: string;
        resourceType: string;
        resourceId: string;
    }): Promise<Comment>;
    updateComment(organizationId: string, userId: string, commentId: string, content: string): Promise<Comment>;
    deleteComment(organizationId: string, userId: string, commentId: string): Promise<void>;
    replyToComment(organizationId: string, userId: string, userName: string | undefined, parentId: string, content: string): Promise<Comment>;
    likeComment(organizationId: string, userId: string, commentId: string): Promise<void>;
    unlikeComment(organizationId: string, userId: string, commentId: string): Promise<void>;
    getReplies(organizationId: string, commentId: string): Promise<Comment[]>;
}
//# sourceMappingURL=CommentService.d.ts.map