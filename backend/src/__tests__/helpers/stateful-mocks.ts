/**
 * Stateful Mock Infrastructure for Integration Tests
 * Maintains in-memory state across requests within a test
 */

export class MockDataStore {
    private organizations: Map<string, any> = new Map();
    private users: Map<string, any> = new Map();
    private userOrganizations: Map<string, any[]> = new Map();
    private activities: Map<string, any> = new Map();

    // Organization methods
    createOrganization(org: any) {
        this.organizations.set(org.id, {
            ...org,
            createdAt: new Date(),
            status: org.status || 'active',
            type: org.type || 'root'
        });
        return this.organizations.get(org.id);
    }

    getOrganization(id: string) {
        return this.organizations.get(id) || null;
    }

    getAllOrganizations() {
        return Array.from(this.organizations.values());
    }

    deleteOrganization(id: string) {
        return this.organizations.delete(id);
    }

    // User-Organization relationship methods
    addUserToOrganization(userId: string, organizationId: string, role: string = 'member') {
        const org = this.getOrganization(organizationId);
        if (!org) {
            throw new Error('Organization not found');
        }

        const userOrgs = this.userOrganizations.get(userId) || [];
        const existing = userOrgs.find(uo => uo.organizationId === organizationId);
        
        if (existing) {
            throw new Error('User is already a member of this organization');
        }

        const membership = {
            id: `${userId}-${organizationId}`,
            userId,
            organizationId,
            role,
            joinedAt: new Date()
        };

        userOrgs.push(membership);
        this.userOrganizations.set(userId, userOrgs);
        
        return membership;
    }

    getUserOrganizations(userId: string) {
        return this.userOrganizations.get(userId) || [];
    }

    getUserOrganizationsWithDetails(userId: string) {
        const memberships = this.getUserOrganizations(userId);
        return memberships.map(membership => {
            const org = this.getOrganization(membership.organizationId);
            return {
                ...org,
                userRole: membership.role,
                joinedAt: membership.joinedAt
            };
        });
    }

    removeUserFromOrganization(userId: string, organizationId: string) {
        const userOrgs = this.userOrganizations.get(userId) || [];
        const filtered = userOrgs.filter(uo => uo.organizationId !== organizationId);
        
        if (filtered.length === userOrgs.length) {
            throw new Error('User is not a member of this organization');
        }
        
        this.userOrganizations.set(userId, filtered);
        return true;
    }

    switchOrganization(userId: string, organizationId: string) {
        const user = this.getUser(userId) || { id: userId };
        const memberships = this.getUserOrganizations(userId);
        
        if (!memberships.find(m => m.organizationId === organizationId)) {
            throw new Error('User is not a member of this organization');
        }
        
        const updated = { ...user, activeOrgId: organizationId };
        this.users.set(userId, updated);
        return updated;
    }

    getActiveOrganization(userId: string) {
        const user = this.getUser(userId);
        return user?.activeOrgId || null;
    }

    getOrganizationUsers(organizationId: string) {
        const allUsers: any[] = [];
        this.userOrganizations.forEach((memberships, userId) => {
            const membership = memberships.find(m => m.organizationId === organizationId);
            if (membership) {
                allUsers.push({
                    userId,
                    role: membership.role,
                    joinedAt: membership.joinedAt
                });
            }
        });
        return allUsers;
    }

        // User operations
    createUser(user: any): any {
        this.users.set(user.id, { ...user, createdAt: new Date() });
        return this.users.get(user.id);
    }

    getUser(id: string): any | null {
        return this.users.get(id) || null;
    }

    getAllUsers(): any[] {
        return Array.from(this.users.values());
    }

    updateUser(id: string, updates: any): any | null {
        const user = this.users.get(id);
        if (!user) {return null;}
        const updated = { ...user, ...updates };
        this.users.set(id, updated);
        return updated;
    }

    deleteUser(id: string): boolean {
        return this.users.delete(id);
    }

    // Activity operations
    createActivity(activity: any): any {
        const newActivity = { 
            ...activity, 
            attendees: activity.attendees || [], 
            createdAt: new Date() 
        };
        // Generate ID if not provided
        if (!newActivity.id) {
            newActivity.id = `activity-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        }
        this.activities.set(newActivity.id, newActivity);
        return this.activities.get(newActivity.id);
    }

    getActivity(id: string): any | null {
        return this.activities.get(id) || null;
    }

    getAllActivities(): any[] {
        return Array.from(this.activities.values());
    }

    updateActivity(id: string, updates: any): any | null {
        const activity = this.activities.get(id);
        if (!activity) {return null;}
        const updated = { ...activity, ...updates };
        this.activities.set(id, updated);
        return updated;
    }

    deleteActivity(id: string): boolean {
        return this.activities.delete(id);
    }

    // Activity attendee operations
    addAttendee(activityId: string, attendeeId: string): any | null {
        const activity = this.activities.get(activityId);
        if (!activity) {return null;}
        if (!activity.attendees) {
            activity.attendees = [];
        }
        if (!activity.attendees.includes(attendeeId)) {
            activity.attendees.push(attendeeId);
        }
        this.activities.set(activityId, activity);
        return activity;
    }

    removeAttendee(activityId: string, attendeeId: string): any | null {
        const activity = this.activities.get(activityId);
        if (!activity) {return null;}
        if (activity.attendees) {
            activity.attendees = activity.attendees.filter((id: string) => id !== attendeeId);
        }
        this.activities.set(activityId, activity);
        return activity;
    }

    getAttendees(activityId: string): string[] {
        const activity = this.activities.get(activityId);
        return activity?.attendees || [];
    }

    // Clear all data
    clear() {
        this.organizations.clear();
        this.users.clear();
        this.userOrganizations.clear();
        this.activities.clear();
    }
}

// Global instance for tests
export const mockDataStore = new MockDataStore();

/**
 * Create a mock service that uses the stateful data store
 */
export function createStatefulMockService() {
    return {
        // Organization Service methods
        createOrganization: jest.fn().mockImplementation(async (data: any) => mockDataStore.createOrganization(data)),
        
        getOrganizationById: jest.fn().mockImplementation(async (id: string) => mockDataStore.getOrganization(id)),

        getOrganizations: jest.fn().mockImplementation(async () => ({
                data: mockDataStore.getAllOrganizations(),
                pagination: { page: 1, limit: 10, total: mockDataStore.getAllOrganizations().length }
            })),

        deleteOrganization: jest.fn().mockImplementation(async (id: string) => {
            mockDataStore.deleteOrganization(id);
            return { success: true };
        }),

        // User-Organization Service methods
        joinOrganization: jest.fn().mockImplementation(async (userId: string, orgId: string, role: string) => mockDataStore.addUserToOrganization(userId, orgId, role)),

        getUserOrganizations: jest.fn().mockImplementation(async (userId: string) => 
            // Return enriched data with organization details
             mockDataStore.getUserOrganizationsWithDetails(userId)
        ),

        leaveOrganization: jest.fn().mockImplementation(async (userId: string, orgId: string) => mockDataStore.removeUserFromOrganization(userId, orgId)),

        getOrganizationUsers: jest.fn().mockImplementation(async (orgId: string) => mockDataStore.getOrganizationUsers(orgId)),

        switchOrganization: jest.fn().mockImplementation(async (userId: string, orgId: string) => mockDataStore.switchOrganization(userId, orgId)),

        getActiveOrganization: jest.fn().mockImplementation(async (userId: string) => mockDataStore.getActiveOrganization(userId)),

        isMemberOf: jest.fn().mockImplementation(async (userId: string, orgId: string) => {
            const memberships = mockDataStore.getUserOrganizations(userId);
            return memberships.some(m => m.organizationId === orgId);
        }),

        // User Service methods
        createUser: jest.fn().mockImplementation(async (data: any) => mockDataStore.createUser(data)),

        getUserById: jest.fn().mockImplementation(async (id: string) => mockDataStore.getUser(id)),

        updateUser: jest.fn().mockImplementation(async (id: string, updates: any) => mockDataStore.updateUser(id, updates)),

        deleteUser: jest.fn().mockImplementation(async (id: string) => {
            mockDataStore.deleteUser(id);
            return { success: true };
        }),

        getUsers: jest.fn().mockImplementation(async () => ({
                data: mockDataStore.getAllUsers(),
                pagination: { page: 1, limit: 10, total: mockDataStore.getAllUsers().length }
            })),

        // Activity Service methods
        createActivity: jest.fn().mockImplementation(async (organizationId: string, data: any) => 
            // ActivityService.createActivity(organizationId, dto)
             mockDataStore.createActivity({ ...data, organizationId })
        ),

        getActivityById: jest.fn().mockImplementation(async (id: string) => mockDataStore.getActivity(id)),

        getActivity: jest.fn().mockImplementation(async (id: string) => mockDataStore.getActivity(id)),

        getMyActivities: jest.fn().mockImplementation(async () => ({
                data: mockDataStore.getAllActivities(),
                pagination: { page: 1, limit: 10, total: mockDataStore.getAllActivities().length }
            })),

        getActivitiesForUser: jest.fn().mockImplementation(async (userId: string, orgIds: string[], filters: any) => {
            // Filter activities based on activityType if provided
            let activities = mockDataStore.getAllActivities();
            if (filters?.activityType) {
                activities = activities.filter((a: any) => a.activityType === filters.activityType);
            }
            // Return activities array directly (not paginated)
            return activities;
        }),

        updateActivity: jest.fn().mockImplementation(async (id: string, userId: string, updates: any) => 
            // ActivityService.updateActivity(id, userId, updates)
             mockDataStore.updateActivity(id, updates)
        ),

        deleteActivity: jest.fn().mockImplementation(async (id: string, userId?: string) => {
            mockDataStore.deleteActivity(id);
            return { success: true };
        }),

        addAttendee: jest.fn().mockImplementation(async (activityId: string, attendeeId: string) => mockDataStore.addAttendee(activityId, attendeeId)),

        removeAttendee: jest.fn().mockImplementation(async (activityId: string, attendeeId: string) => mockDataStore.removeAttendee(activityId, attendeeId)),

        getAttendees: jest.fn().mockImplementation(async (activityId: string) => mockDataStore.getAttendees(activityId)),

        // Activity participant methods (joinActivity/leaveActivity)
        joinActivity: jest.fn().mockImplementation(async (activityId: string, dto: any) => {
            const attendeeId = dto.userId;
            const activity = mockDataStore.addAttendee(activityId, attendeeId);
            if (!activity) {
                throw new Error('Activity not found');
            }
            return activity;
        }),

        leaveActivity: jest.fn().mockImplementation(async (activityId: string, userId: string) => {
            const activity = mockDataStore.removeAttendee(activityId, userId);
            if (!activity) {
                throw new Error('Activity not found');
            }
            return activity;
        })
    };
}
