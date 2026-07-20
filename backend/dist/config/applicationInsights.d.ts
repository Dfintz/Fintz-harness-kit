import * as appInsights from 'applicationinsights';
import { NextFunction, Request, Response } from 'express';
export declare function initializeApplicationInsights(): void;
export declare function getAppInsightsClient(): appInsights.TelemetryClient | undefined;
export declare function trackEvent(name: string, properties?: Record<string, string>): void;
export declare function trackMetric(name: string, value: number): void;
export declare function trackException(exception: Error, properties?: Record<string, string>): void;
export type SeverityLevel = 'Verbose' | 'Information' | 'Warning' | 'Error' | 'Critical';
export declare function trackTrace(message: string, severity?: SeverityLevel, properties?: Record<string, string>): void;
export declare function applicationInsightsMiddleware(): (req: Request, res: Response, next: NextFunction) => void;
//# sourceMappingURL=applicationInsights.d.ts.map