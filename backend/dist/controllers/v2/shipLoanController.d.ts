import { Request, Response } from 'express';
export declare class ShipLoanControllerV2 {
    private shipLoanRepository;
    requestLoan(req: Request, res: Response): Promise<void>;
    getLoans(req: Request, res: Response): Promise<void>;
    getLoanById(req: Request, res: Response): Promise<void>;
    approveLoan(req: Request, res: Response): Promise<void>;
    activateLoan(req: Request, res: Response): Promise<void>;
    returnShip(req: Request, res: Response): Promise<void>;
    declineLoan(req: Request, res: Response): Promise<void>;
    getOrgLoanHistory(req: Request, res: Response): Promise<void>;
}
//# sourceMappingURL=shipLoanController.d.ts.map