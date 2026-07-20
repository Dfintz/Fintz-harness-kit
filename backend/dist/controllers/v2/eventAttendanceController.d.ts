import { Request, Response } from 'express';
export declare class EventAttendanceControllerV2 {
    private attendanceService;
    private readonly notificationService;
    private readonly analyticsService;
    constructor();
    private getService;
    recordAttendance(req: Request, res: Response): Promise<void>;
    getAttendanceRecords(req: Request, res: Response): Promise<void>;
    updateAttendanceStatus(req: Request, res: Response): Promise<void>;
    getAttendanceStats(req: Request, res: Response): Promise<void>;
    getUserAttendanceHistory(req: Request, res: Response): Promise<void>;
    getAttendanceCorrelationSummary(req: Request, res: Response): Promise<void>;
}
//# sourceMappingURL=eventAttendanceController.d.ts.map