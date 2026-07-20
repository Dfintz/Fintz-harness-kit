import { NextFunction, Request, Response } from 'express';
export declare const generateCsrfToken: () => string;
export declare const validateCsrfToken: (cookieToken: string, headerToken: string) => boolean;
export declare const csrfTokenMiddleware: (req: Request, res: Response, next: NextFunction) => void;
export declare const validateCsrfMiddleware: (req: Request, res: Response, next: NextFunction) => void;
export declare const csrfProtection: {
    generate: (req: Request, res: Response, next: NextFunction) => void;
    validate: (req: Request, res: Response, next: NextFunction) => void;
    protect: (req: Request, res: Response, next: NextFunction) => void;
};
export declare const csrfProtectionFor: (methods?: string[]) => (req: Request, res: Response, next: NextFunction) => void;
//# sourceMappingURL=csrf.d.ts.map