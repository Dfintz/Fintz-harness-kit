export declare enum LoanStatus {
    PENDING = "pending",
    APPROVED = "approved",
    ACTIVE = "active",
    RETURNED = "returned",
    DECLINED = "declined",
    OVERDUE = "overdue"
}
export declare class ShipLoan {
    id: string;
    shipId: string;
    shipName?: string;
    lenderId: string;
    borrowerId: string;
    organizationId?: string;
    activityId?: string;
    activityName?: string;
    scope?: string;
    purpose?: string;
    requestDate: Date;
    approvedDate?: Date;
    startDate: Date;
    expectedReturnDate: Date;
    actualReturnDate?: Date;
    status: LoanStatus;
    terms?: string;
    notes?: string;
    insuranceRequired: boolean;
    createdAt: Date;
    updatedAt: Date;
}
//# sourceMappingURL=ShipLoan.d.ts.map