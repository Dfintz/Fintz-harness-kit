import { Request, Response } from 'express';
export declare class CalendarControllerV2 {
    private readonly service;
    getEvents(req: Request, res: Response): Promise<void>;
    getEventById(req: Request, res: Response): Promise<void>;
    downloadEventICS(req: Request, res: Response): Promise<void>;
    exportOrgCalendar(req: Request, res: Response): Promise<void>;
    exportUserCalendar(req: Request, res: Response): Promise<void>;
}
//# sourceMappingURL=calendarController.d.ts.map