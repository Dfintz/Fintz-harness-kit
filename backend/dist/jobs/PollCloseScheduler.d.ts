export declare class PollCloseScheduler {
    private readonly pollService;
    private jobs;
    constructor();
    start(): void;
    stop(): void;
    getStatus(): {
        name: string;
        running: boolean;
    }[];
}
export declare const pollCloseScheduler: PollCloseScheduler;
//# sourceMappingURL=PollCloseScheduler.d.ts.map