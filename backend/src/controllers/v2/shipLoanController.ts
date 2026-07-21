/**
 * Ship Loan Controller V2
 * Handles ship loan request and management endpoints with standardized responses
 */

import { Request, Response } from 'express';

import { AppDataSource } from '../../config/database';
import { ApiError } from '../../middleware/errorHandlerV2';
import { buildHateoasLinks } from '../../middleware/queryParser';
import { LoanStatus, ShipLoan } from '../../models/ShipLoan';
import { ApiErrorCode } from '../../types/api';
import { getErrorMessage } from '../../utils/errorHandler';
import { logger } from '../../utils/logger';
import { paginateRepository } from '../../utils/pagination';

export class ShipLoanControllerV2 {
  private shipLoanRepository = AppDataSource.getRepository(ShipLoan);

  // ==================== SHIP LOAN CRUD ====================

  /**
   * POST /api/v2/ship-loans
   * Request a new ship loan
   */
  async requestLoan(req: Request, res: Response): Promise<void> {
    const {
      shipId,
      lenderId,
      borrowerId,
      startDate,
      expectedReturnDate,
      terms,
      insuranceRequired,
      notes,
    } = req.body;

    // Validate required fields
    if (!shipId || !lenderId || !borrowerId) {
      throw new ApiError(
        ApiErrorCode.MISSING_REQUIRED_FIELD,
        'shipId, lenderId, and borrowerId are required',
        400
      );
    }

    try {
      const loan = this.shipLoanRepository.create({
        id: `loan-${Date.now()}`,
        shipId,
        lenderId,
        borrowerId,
        requestDate: new Date(),
        startDate: new Date(startDate),
        expectedReturnDate: new Date(expectedReturnDate),
        terms,
        notes,
        insuranceRequired: insuranceRequired || false,
        status: LoanStatus.PENDING,
      });

      await this.shipLoanRepository.save(loan);

      logger.info('Ship loan requested', {
        loanId: loan.id,
        shipId,
        lenderId,
        borrowerId,
      });

      res.status(201);
      res.success(loan);
    } catch (error: unknown) {
      logger.error('Error requesting ship loan', { error });
      throw new ApiError(
        ApiErrorCode.INTERNAL_ERROR,
        getErrorMessage(error, 'Failed to request ship loan'),
        500
      );
    }
  }

  /**
   * GET /api/v2/ship-loans
   * Get all ship loans with pagination
   */
  async getLoans(req: Request, res: Response): Promise<void> {
    const { limit, offset } = req.queryParams || { limit: 20, offset: 0 };

    try {
      const page = Math.floor(offset / limit) + 1;
      const paginationOptions = {
        page,
        limit,
        sortBy: 'requestDate',
        sortOrder: 'DESC' as const,
      };

      const result = await paginateRepository(
        this.shipLoanRepository,
        paginationOptions,
        undefined,
        'requestDate'
      );

      const links = buildHateoasLinks('/api/v2/ship-loans', offset, limit, result.pagination.total);

      logger.info('Ship loans retrieved', {
        count: result.data.length,
        total: result.pagination.total,
      });

      res.paginated(
        result.data,
        {
          total: result.pagination.total,
          limit,
          offset,
          hasMore: result.pagination.hasNext,
        },
        links
      );
    } catch (error: unknown) {
      logger.error('Error fetching ship loans', { error });
      throw new ApiError(
        ApiErrorCode.INTERNAL_ERROR,
        getErrorMessage(error, 'Failed to fetch ship loans'),
        500
      );
    }
  }

  /**
   * GET /api/v2/ship-loans/:id
   * Get a specific ship loan by ID
   */
  async getLoanById(req: Request, res: Response): Promise<void> {
    const { id } = req.params;

    try {
      const loan = await this.shipLoanRepository.findOne({ where: { id } });

      if (!loan) {
        throw new ApiError(ApiErrorCode.RESOURCE_NOT_FOUND, 'Ship loan not found', 404);
      }

      logger.info('Ship loan retrieved', { loanId: id });

      res.success(loan);
    } catch (error: unknown) {
      if (error instanceof ApiError) {
        throw error;
      }
      logger.error('Error fetching ship loan', { error, loanId: id });
      throw new ApiError(
        ApiErrorCode.INTERNAL_ERROR,
        getErrorMessage(error, 'Failed to fetch ship loan'),
        500
      );
    }
  }

  // ==================== LOAN MANAGEMENT ====================

  /**
   * POST /api/v2/ship-loans/:id/approve
   * Approve a pending ship loan
   */
  async approveLoan(req: Request, res: Response): Promise<void> {
    const { id } = req.params;

    try {
      const loan = await this.shipLoanRepository.findOne({ where: { id } });

      if (!loan) {
        throw new ApiError(ApiErrorCode.RESOURCE_NOT_FOUND, 'Ship loan not found', 404);
      }

      if (loan.status !== LoanStatus.PENDING) {
        throw new ApiError(ApiErrorCode.VALIDATION_ERROR, 'Loan is not in pending status', 400);
      }

      loan.status = LoanStatus.APPROVED;
      loan.approvedDate = new Date();

      await this.shipLoanRepository.save(loan);

      logger.info('Ship loan approved', { loanId: id });

      res.success(loan);
    } catch (error: unknown) {
      if (error instanceof ApiError) {
        throw error;
      }
      logger.error('Error approving ship loan', { error, loanId: id });
      throw new ApiError(
        ApiErrorCode.INTERNAL_ERROR,
        getErrorMessage(error, 'Failed to approve ship loan'),
        500
      );
    }
  }

  /**
   * POST /api/v2/ship-loans/:id/activate
   * Activate an approved ship loan
   */
  async activateLoan(req: Request, res: Response): Promise<void> {
    const { id } = req.params;

    try {
      const loan = await this.shipLoanRepository.findOne({ where: { id } });

      if (!loan) {
        throw new ApiError(ApiErrorCode.RESOURCE_NOT_FOUND, 'Ship loan not found', 404);
      }

      if (loan.status !== LoanStatus.APPROVED) {
        throw new ApiError(ApiErrorCode.VALIDATION_ERROR, 'Loan must be approved first', 400);
      }

      loan.status = LoanStatus.ACTIVE;
      await this.shipLoanRepository.save(loan);

      logger.info('Ship loan activated', { loanId: id });

      res.success(loan);
    } catch (error: unknown) {
      if (error instanceof ApiError) {
        throw error;
      }
      logger.error('Error activating ship loan', { error, loanId: id });
      throw new ApiError(
        ApiErrorCode.INTERNAL_ERROR,
        getErrorMessage(error, 'Failed to activate ship loan'),
        500
      );
    }
  }

  /**
   * POST /api/v2/ship-loans/:id/return
   * Mark a ship loan as returned
   */
  async returnShip(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    const { notes } = req.body;

    try {
      const loan = await this.shipLoanRepository.findOne({ where: { id } });

      if (!loan) {
        throw new ApiError(ApiErrorCode.RESOURCE_NOT_FOUND, 'Ship loan not found', 404);
      }

      loan.status = LoanStatus.RETURNED;
      loan.actualReturnDate = new Date();
      if (notes) {
        loan.notes = notes;
      }

      await this.shipLoanRepository.save(loan);

      logger.info('Ship returned from loan', { loanId: id });

      res.success(loan);
    } catch (error: unknown) {
      if (error instanceof ApiError) {
        throw error;
      }
      logger.error('Error returning ship', { error, loanId: id });
      throw new ApiError(
        ApiErrorCode.INTERNAL_ERROR,
        getErrorMessage(error, 'Failed to return ship'),
        500
      );
    }
  }

  /**
   * POST /api/v2/ship-loans/:id/decline
   * Decline a pending ship loan
   */
  async declineLoan(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    const { notes } = req.body;

    try {
      const loan = await this.shipLoanRepository.findOne({ where: { id } });

      if (!loan) {
        throw new ApiError(ApiErrorCode.RESOURCE_NOT_FOUND, 'Ship loan not found', 404);
      }

      loan.status = LoanStatus.DECLINED;
      if (notes) {
        loan.notes = notes;
      }

      await this.shipLoanRepository.save(loan);

      logger.info('Ship loan declined', { loanId: id });

      res.success(loan);
    } catch (error: unknown) {
      if (error instanceof ApiError) {
        throw error;
      }
      logger.error('Error declining ship loan', { error, loanId: id });
      throw new ApiError(
        ApiErrorCode.INTERNAL_ERROR,
        getErrorMessage(error, 'Failed to decline ship loan'),
        500
      );
    }
  }

  /**
   * GET /api/v2/ship-loans/organization/:orgId
   * Get loan history for an organization (active + returned)
   */
  async getOrgLoanHistory(req: Request, res: Response): Promise<void> {
    const { orgId } = req.params;
    const { status } = req.query;
    const { limit, offset } = req.queryParams || { limit: 50, offset: 0 };

    try {
      const page = Math.floor(offset / limit) + 1;

      const where: Record<string, unknown> = { organizationId: orgId };
      if (status && typeof status === 'string') {
        where.status = status;
      }

      const result = await paginateRepository(
        this.shipLoanRepository,
        { page, limit, sortBy: 'startDate', sortOrder: 'DESC' },
        where,
        'startDate'
      );

      const links = buildHateoasLinks(
        `/api/v2/ship-loans/organization/${orgId}`,
        offset,
        limit,
        result.pagination.total
      );

      res.paginated(
        result.data,
        {
          total: result.pagination.total,
          limit,
          offset,
          hasMore: result.pagination.hasNext,
        },
        links
      );
    } catch (error: unknown) {
      logger.error('Error fetching org loan history', { error, orgId });
      throw new ApiError(
        ApiErrorCode.INTERNAL_ERROR,
        getErrorMessage(error, 'Failed to fetch loan history'),
        500
      );
    }
  }
}
