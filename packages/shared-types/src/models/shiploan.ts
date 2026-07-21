/**
 * Ship loan domain types.
 *
 * Per ADR-004, the status vocabulary is exposed as a runtime-introspectable
 * `as const` array plus a derived union type, with exact parity to the backend
 * `ShipLoan.LoanStatus` enum (no client-only exclusions).
 */

/** Canonical loan-status values (runtime source set for {@link LoanStatus}). */
export const LOAN_STATUS_VALUES = [
  'pending',
  'approved',
  'active',
  'returned',
  'declined',
  'overdue',
] as const;

export type LoanStatus = (typeof LOAN_STATUS_VALUES)[number];

export interface ShipLoan {
  id: string;
  shipId: string;
  lenderId: string;
  borrowerId: string;
  requestDate: Date | string;
  approvedDate?: Date | string;
  startDate: Date | string;
  expectedReturnDate: Date | string;
  actualReturnDate?: Date | string;
  status: LoanStatus;
  terms?: string;
  notes?: string;
  insuranceRequired: boolean;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface CreateShipLoanRequest {
  shipId: string;
  borrowerId: string;
  startDate: Date | string;
  expectedReturnDate: Date | string;
  terms?: string;
  notes?: string;
  insuranceRequired?: boolean;
}

export interface UpdateShipLoanRequest {
  startDate?: Date | string;
  expectedReturnDate?: Date | string;
  actualReturnDate?: Date | string;
  terms?: string;
  notes?: string;
  insuranceRequired?: boolean;
}

export interface ShipLoanStatusUpdateRequest {
  status: LoanStatus;
  notes?: string;
}
