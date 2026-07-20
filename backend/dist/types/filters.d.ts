export interface DateRangeFilter {
    startDate?: Date | string;
    endDate?: Date | string;
}
export interface BaseFilter {
    id?: string;
    ids?: string[];
    createdAt?: DateRangeFilter;
    updatedAt?: DateRangeFilter;
}
export interface OrganizationFilter extends BaseFilter {
    organizationId: string;
}
export interface UserFilter extends DateRangeFilter {
    organizationId?: string;
    role?: 'user' | 'admin' | 'superadmin';
    isActive?: boolean;
    isVerified?: boolean;
    searchTerm?: string;
}
export interface ActivityFilter extends OrganizationFilter {
    status?: 'scheduled' | 'active' | 'completed' | 'cancelled';
    type?: string;
    participantId?: string;
    startDate?: DateRangeFilter;
    endDate?: DateRangeFilter;
}
export interface FleetFilter extends OrganizationFilter {
    isPublic?: boolean;
    memberId?: string;
    name?: string;
}
export interface ShipFilter extends OrganizationFilter {
    manufacturer?: string;
    role?: string;
    minCrew?: number;
    maxCrew?: number;
    availableOnly?: boolean;
}
export interface TextSearchFilter {
    searchTerm: string;
    fields: string[];
    caseSensitive?: boolean;
}
export interface StatusFilter {
    status?: string | string[];
    excludeStatus?: string | string[];
}
export interface OwnershipFilter {
    ownerId?: string;
    createdBy?: string;
    assignedTo?: string;
}
//# sourceMappingURL=filters.d.ts.map