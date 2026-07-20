import { Request, Response } from 'express';
export interface WebVitalsMetric {
    name: string;
    value: number;
    rating: 'good' | 'needs-improvement' | 'poor';
    delta: number;
    id: string;
    navigationType: string;
    timestamp: number;
    url: string;
    userAgent: string;
}
export declare const trackWebVitals: (req: Request, res: Response) => Promise<void>;
export declare const getWebVitalsStats: (req: Request, res: Response) => Promise<void>;
//# sourceMappingURL=MetricsController.d.ts.map