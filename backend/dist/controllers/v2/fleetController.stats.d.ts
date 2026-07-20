export interface StatCountResult {
    size?: string;
    role?: string;
    manufacturer?: string;
    career?: string;
    count: string;
}
export declare const toStatRecord: (rows: StatCountResult[], key: "size" | "role" | "manufacturer" | "career") => Record<string, number>;
//# sourceMappingURL=fleetController.stats.d.ts.map