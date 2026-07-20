export interface PkcePair {
    readonly verifier: string;
    readonly challenge: string;
    readonly method: 'S256';
}
export declare function generatePkcePair(): PkcePair;
//# sourceMappingURL=pkce.d.ts.map