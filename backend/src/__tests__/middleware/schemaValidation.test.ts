import { Request, Response, NextFunction } from 'express';

import { validateSchema, schemas } from '../../middleware/schemaValidation';

describe('Schema Validation Middleware', () => {
    let mockReq: Partial<Request>;
    let mockRes: Partial<Response>;
    let nextFunction: NextFunction;
    let statusMock: jest.Mock;
    let jsonMock: jest.Mock;

    beforeEach(() => {
        statusMock = jest.fn().mockReturnThis();
        jsonMock = jest.fn();
        mockReq = {
            body: {},
            query: {},
            params: {},
        };
        mockRes = {
            status: statusMock,
            json: jsonMock,
        };
        nextFunction = jest.fn();
    });

    describe('validateSchema middleware factory', () => {
        it('should validate valid data and call next()', () => {
            const schema = schemas.id;
            mockReq.params = { id: 'test-id-123' };

            const middleware = validateSchema(schema, 'params');
            middleware(mockReq as Request, mockRes as Response, nextFunction);

            expect(nextFunction).toHaveBeenCalled();
            expect(statusMock).not.toHaveBeenCalled();
        });

        it('should return 400 for invalid data', () => {
            const schema = schemas.id;
            mockReq.params = { id: '' }; // Empty ID is invalid

            const middleware = validateSchema(schema, 'params');
            middleware(mockReq as Request, mockRes as Response, nextFunction);

            expect(nextFunction).not.toHaveBeenCalled();
            expect(statusMock).toHaveBeenCalledWith(400);
            expect(jsonMock).toHaveBeenCalledWith(
                expect.objectContaining({
                    message: 'Validation error',
                    errors: expect.any(Array),
                })
            );
        });
    });

    describe('Organization schemas', () => {
        it('should validate organization creation with valid data', () => {
            mockReq.body = {
                id: 'org-123',
                name: 'Test Organization',
                members: ['user1', 'user2'],
            };

            const middleware = validateSchema(schemas.organization.create);
            middleware(mockReq as Request, mockRes as Response, nextFunction);

            expect(nextFunction).toHaveBeenCalled();
            expect(statusMock).not.toHaveBeenCalled();
        });

        it('should reject organization with short name', () => {
            mockReq.body = {
                id: 'org-123',
                name: 'AB', // Too short (min 3)
                members: [],
            };

            const middleware = validateSchema(schemas.organization.create);
            middleware(mockReq as Request, mockRes as Response, nextFunction);

            expect(nextFunction).not.toHaveBeenCalled();
            expect(statusMock).toHaveBeenCalledWith(400);
        });
    });

    describe('Trading route schemas', () => {
        it('should validate trading route creation', () => {
            mockReq.body = {
                name: 'Hurston to Crusader Route',
                origin: 'Hurston',
                destination: 'Crusader',
                commodity: 'Medical Supplies',
                buyPrice: 100,
                sellPrice: 150,
            };

            const middleware = validateSchema(schemas.tradingRoute.create);
            middleware(mockReq as Request, mockRes as Response, nextFunction);

            expect(nextFunction).toHaveBeenCalled();
            expect(statusMock).not.toHaveBeenCalled();
        });

        it('should reject negative prices', () => {
            mockReq.body = {
                name: 'Test Route',
                origin: 'A',
                destination: 'B',
                commodity: 'Goods',
                buyPrice: -10, // Invalid
                sellPrice: 100,
            };

            const middleware = validateSchema(schemas.tradingRoute.create);
            middleware(mockReq as Request, mockRes as Response, nextFunction);

            expect(nextFunction).not.toHaveBeenCalled();
            expect(statusMock).toHaveBeenCalledWith(400);
        });
    });

    describe('Ship loan schemas', () => {
        it('should validate ship loan request', () => {
            mockReq.body = {
                shipId: 'ship-123',
                shipName: 'Carrack',
                borrowerId: 'user-456',
                borrowerName: 'John Doe',
                duration: 7,
                purpose: 'Need ship for exploration mission in Pyro system',
            };

            const middleware = validateSchema(schemas.shipLoan.request);
            middleware(mockReq as Request, mockRes as Response, nextFunction);

            expect(nextFunction).toHaveBeenCalled();
            expect(statusMock).not.toHaveBeenCalled();
        });

        it('should reject invalid duration', () => {
            mockReq.body = {
                shipId: 'ship-123',
                shipName: 'Carrack',
                borrowerId: 'user-456',
                borrowerName: 'John Doe',
                duration: 400, // Exceeds max of 365
                purpose: 'Need ship for exploration mission',
            };

            const middleware = validateSchema(schemas.shipLoan.request);
            middleware(mockReq as Request, mockRes as Response, nextFunction);

            expect(nextFunction).not.toHaveBeenCalled();
            expect(statusMock).toHaveBeenCalledWith(400);
        });
    });

    describe('Bounty schemas', () => {
        it('should validate bounty creation', () => {
            mockReq.body = {
                targetId: 'target-123',
                targetName: 'Pirate Leader',
                reward: 50000,
                description: 'High priority target wanted for piracy and assault',
                difficulty: 'hard',
            };

            const middleware = validateSchema(schemas.bounty.create);
            middleware(mockReq as Request, mockRes as Response, nextFunction);

            expect(nextFunction).toHaveBeenCalled();
            expect(statusMock).not.toHaveBeenCalled();
        });

        it('should reject invalid difficulty', () => {
            mockReq.body = {
                targetId: 'target-123',
                targetName: 'Pirate',
                reward: 1000,
                description: 'Wanted criminal',
                difficulty: 'impossible', // Invalid value
            };

            const middleware = validateSchema(schemas.bounty.create);
            middleware(mockReq as Request, mockRes as Response, nextFunction);

            expect(nextFunction).not.toHaveBeenCalled();
            expect(statusMock).toHaveBeenCalledWith(400);
        });
    });

    describe('Contract schemas', () => {
        it('should validate contract creation', () => {
            mockReq.body = {
                title: 'Cargo Delivery to Hurston',
                description: 'Deliver 100 SCU of medical supplies to Hurston',
                contractType: 'cargo',
                reward: 10000,
            };

            const middleware = validateSchema(schemas.contract.create);
            middleware(mockReq as Request, mockRes as Response, nextFunction);

            expect(nextFunction).toHaveBeenCalled();
            expect(statusMock).not.toHaveBeenCalled();
        });

        it('should reject invalid contract type', () => {
            mockReq.body = {
                title: 'Test Contract',
                description: 'Test description that is long enough',
                contractType: 'invalid-type', // Not in enum
                reward: 1000,
            };

            const middleware = validateSchema(schemas.contract.create);
            middleware(mockReq as Request, mockRes as Response, nextFunction);

            expect(nextFunction).not.toHaveBeenCalled();
            expect(statusMock).toHaveBeenCalledWith(400);
        });
    });

    describe('stripUnknown option', () => {
        it('should remove unknown fields from validated data', () => {
            mockReq.body = {
                id: 'test-123',
                unknownField: 'should be removed',
                anotherUnknown: 'also removed',
            };

            const middleware = validateSchema(schemas.id, 'body');
            middleware(mockReq as Request, mockRes as Response, nextFunction);

            expect(nextFunction).toHaveBeenCalled();
            expect(mockReq.body).toHaveProperty('id');
            expect(mockReq.body).not.toHaveProperty('unknownField');
            expect(mockReq.body).not.toHaveProperty('anotherUnknown');
        });
    });
});
