import { Organization } from './Organization';
export declare class GuildOrganization {
    guildId: string;
    organizationId: string;
    organization?: Organization;
    guildName?: string;
    isPrimary: boolean;
    isActive: boolean;
    createdBy?: string;
    metadata?: Record<string, unknown>;
    deactivatedAt?: Date;
    deactivatedBy?: string;
    createdAt: Date;
    updatedAt: Date;
    isUsable(): boolean;
    deactivate(userId: string): void;
    reactivate(): void;
}
//# sourceMappingURL=GuildOrganization.d.ts.map