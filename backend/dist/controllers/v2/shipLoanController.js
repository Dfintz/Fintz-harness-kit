"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ShipLoanControllerV2 = void 0;
const database_1 = require("../../config/database");
const errorHandlerV2_1 = require("../../middleware/errorHandlerV2");
const queryParser_1 = require("../../middleware/queryParser");
const ShipLoan_1 = require("../../models/ShipLoan");
const api_1 = require("../../types/api");
const errorHandler_1 = require("../../utils/errorHandler");
const logger_1 = require("../../utils/logger");
const pagination_1 = require("../../utils/pagination");
class ShipLoanControllerV2 {
    shipLoanRepository = database_1.AppDataSource.getRepository(ShipLoan_1.ShipLoan);
    async requestLoan(req, res) {
        const { shipId, lenderId, borrowerId, startDate, expectedReturnDate, terms, insuranceRequired, notes, } = req.body;
        if (!shipId || !lenderId || !borrowerId) {
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.MISSING_REQUIRED_FIELD, 'shipId, lenderId, and borrowerId are required', 400);
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
                status: ShipLoan_1.LoanStatus.PENDING,
            });
            await this.shipLoanRepository.save(loan);
            logger_1.logger.info('Ship loan requested', {
                loanId: loan.id,
                shipId,
                lenderId,
                borrowerId,
            });
            res.status(201);
            res.success(loan);
        }
        catch (error) {
            logger_1.logger.error('Error requesting ship loan', { error });
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, (0, errorHandler_1.getErrorMessage)(error, 'Failed to request ship loan'), 500);
        }
    }
    async getLoans(req, res) {
        const { limit, offset } = req.queryParams || { limit: 20, offset: 0 };
        try {
            const page = Math.floor(offset / limit) + 1;
            const paginationOptions = {
                page,
                limit,
                sortBy: 'requestDate',
                sortOrder: 'DESC',
            };
            const result = await (0, pagination_1.paginateRepository)(this.shipLoanRepository, paginationOptions, undefined, 'requestDate');
            const links = (0, queryParser_1.buildHateoasLinks)('/api/v2/ship-loans', offset, limit, result.pagination.total);
            logger_1.logger.info('Ship loans retrieved', {
                count: result.data.length,
                total: result.pagination.total,
            });
            res.paginated(result.data, {
                total: result.pagination.total,
                limit,
                offset,
                hasMore: result.pagination.hasNext,
            }, links);
        }
        catch (error) {
            logger_1.logger.error('Error fetching ship loans', { error });
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, (0, errorHandler_1.getErrorMessage)(error, 'Failed to fetch ship loans'), 500);
        }
    }
    async getLoanById(req, res) {
        const { id } = req.params;
        try {
            const loan = await this.shipLoanRepository.findOne({ where: { id } });
            if (!loan) {
                throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.RESOURCE_NOT_FOUND, 'Ship loan not found', 404);
            }
            logger_1.logger.info('Ship loan retrieved', { loanId: id });
            res.success(loan);
        }
        catch (error) {
            if (error instanceof errorHandlerV2_1.ApiError) {
                throw error;
            }
            logger_1.logger.error('Error fetching ship loan', { error, loanId: id });
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, (0, errorHandler_1.getErrorMessage)(error, 'Failed to fetch ship loan'), 500);
        }
    }
    async approveLoan(req, res) {
        const { id } = req.params;
        try {
            const loan = await this.shipLoanRepository.findOne({ where: { id } });
            if (!loan) {
                throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.RESOURCE_NOT_FOUND, 'Ship loan not found', 404);
            }
            if (loan.status !== ShipLoan_1.LoanStatus.PENDING) {
                throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.VALIDATION_ERROR, 'Loan is not in pending status', 400);
            }
            loan.status = ShipLoan_1.LoanStatus.APPROVED;
            loan.approvedDate = new Date();
            await this.shipLoanRepository.save(loan);
            logger_1.logger.info('Ship loan approved', { loanId: id });
            res.success(loan);
        }
        catch (error) {
            if (error instanceof errorHandlerV2_1.ApiError) {
                throw error;
            }
            logger_1.logger.error('Error approving ship loan', { error, loanId: id });
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, (0, errorHandler_1.getErrorMessage)(error, 'Failed to approve ship loan'), 500);
        }
    }
    async activateLoan(req, res) {
        const { id } = req.params;
        try {
            const loan = await this.shipLoanRepository.findOne({ where: { id } });
            if (!loan) {
                throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.RESOURCE_NOT_FOUND, 'Ship loan not found', 404);
            }
            if (loan.status !== ShipLoan_1.LoanStatus.APPROVED) {
                throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.VALIDATION_ERROR, 'Loan must be approved first', 400);
            }
            loan.status = ShipLoan_1.LoanStatus.ACTIVE;
            await this.shipLoanRepository.save(loan);
            logger_1.logger.info('Ship loan activated', { loanId: id });
            res.success(loan);
        }
        catch (error) {
            if (error instanceof errorHandlerV2_1.ApiError) {
                throw error;
            }
            logger_1.logger.error('Error activating ship loan', { error, loanId: id });
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, (0, errorHandler_1.getErrorMessage)(error, 'Failed to activate ship loan'), 500);
        }
    }
    async returnShip(req, res) {
        const { id } = req.params;
        const { notes } = req.body;
        try {
            const loan = await this.shipLoanRepository.findOne({ where: { id } });
            if (!loan) {
                throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.RESOURCE_NOT_FOUND, 'Ship loan not found', 404);
            }
            loan.status = ShipLoan_1.LoanStatus.RETURNED;
            loan.actualReturnDate = new Date();
            if (notes) {
                loan.notes = notes;
            }
            await this.shipLoanRepository.save(loan);
            logger_1.logger.info('Ship returned from loan', { loanId: id });
            res.success(loan);
        }
        catch (error) {
            if (error instanceof errorHandlerV2_1.ApiError) {
                throw error;
            }
            logger_1.logger.error('Error returning ship', { error, loanId: id });
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, (0, errorHandler_1.getErrorMessage)(error, 'Failed to return ship'), 500);
        }
    }
    async declineLoan(req, res) {
        const { id } = req.params;
        const { notes } = req.body;
        try {
            const loan = await this.shipLoanRepository.findOne({ where: { id } });
            if (!loan) {
                throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.RESOURCE_NOT_FOUND, 'Ship loan not found', 404);
            }
            loan.status = ShipLoan_1.LoanStatus.DECLINED;
            if (notes) {
                loan.notes = notes;
            }
            await this.shipLoanRepository.save(loan);
            logger_1.logger.info('Ship loan declined', { loanId: id });
            res.success(loan);
        }
        catch (error) {
            if (error instanceof errorHandlerV2_1.ApiError) {
                throw error;
            }
            logger_1.logger.error('Error declining ship loan', { error, loanId: id });
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, (0, errorHandler_1.getErrorMessage)(error, 'Failed to decline ship loan'), 500);
        }
    }
    async getOrgLoanHistory(req, res) {
        const { orgId } = req.params;
        const { status } = req.query;
        const { limit, offset } = req.queryParams || { limit: 50, offset: 0 };
        try {
            const page = Math.floor(offset / limit) + 1;
            const where = { organizationId: orgId };
            if (status && typeof status === 'string') {
                where.status = status;
            }
            const result = await (0, pagination_1.paginateRepository)(this.shipLoanRepository, { page, limit, sortBy: 'startDate', sortOrder: 'DESC' }, where, 'startDate');
            const links = (0, queryParser_1.buildHateoasLinks)(`/api/v2/ship-loans/organization/${orgId}`, offset, limit, result.pagination.total);
            res.paginated(result.data, {
                total: result.pagination.total,
                limit,
                offset,
                hasMore: result.pagination.hasNext,
            }, links);
        }
        catch (error) {
            logger_1.logger.error('Error fetching org loan history', { error, orgId });
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, (0, errorHandler_1.getErrorMessage)(error, 'Failed to fetch loan history'), 500);
        }
    }
}
exports.ShipLoanControllerV2 = ShipLoanControllerV2;
//# sourceMappingURL=shipLoanController.js.map