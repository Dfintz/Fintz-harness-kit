export interface BotShutdownStep {
    readonly id?: string;
    readonly dependsOn?: readonly string[];
    readonly successMessage: string;
    readonly run: () => Promise<void> | void;
    readonly failureMessage?: string;
}
export interface OrderedShutdownPlan {
    readonly ordered: readonly BotShutdownStep[];
    readonly warnings: readonly string[];
}
export declare function orderShutdownSteps(steps: readonly BotShutdownStep[]): OrderedShutdownPlan;
export declare function runBotShutdownSteps(processName: string, steps: readonly BotShutdownStep[]): Promise<void>;
//# sourceMappingURL=botShutdownCoordinator.d.ts.map