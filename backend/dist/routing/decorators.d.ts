import 'reflect-metadata';
export declare const CONTROLLER_KEY = "controller:path";
export declare const ROUTES_KEY = "controller:routes";
export declare const MIDDLEWARE_KEY = "route:middleware";
export type HttpMethod = 'get' | 'post' | 'put' | 'patch' | 'delete';
export interface RouteMetadata {
    method: HttpMethod;
    path: string;
    handlerName: string;
    middleware: Function[];
}
export declare function Controller(basePath?: string): ClassDecorator;
export declare const Get: (path?: string) => MethodDecorator;
export declare const Post: (path?: string) => MethodDecorator;
export declare const Put: (path?: string) => MethodDecorator;
export declare const Patch: (path?: string) => MethodDecorator;
export declare const Delete: (path?: string) => MethodDecorator;
export declare function UseMiddleware(...middleware: Function[]): MethodDecorator;
export declare function UseControllerMiddleware(...middleware: Function[]): ClassDecorator;
export declare function Authenticate(): MethodDecorator;
export declare function ValidateBody(schema: unknown): MethodDecorator;
export declare function ValidateQuery(schema: unknown): MethodDecorator;
export declare function ValidateParams(schema: unknown): MethodDecorator;
//# sourceMappingURL=decorators.d.ts.map