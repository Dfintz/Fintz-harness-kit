export type RsiChangeEntityType = 'citizen' | 'organization' | 'member';
export declare class RsiChangeHistory {
    id: string;
    entityType: RsiChangeEntityType;
    entityId: string;
    fieldName: string;
    oldValue?: string | null;
    newValue?: string | null;
    detectedAt: Date;
}
//# sourceMappingURL=RsiChangeHistory.d.ts.map