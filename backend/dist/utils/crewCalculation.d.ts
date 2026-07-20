export type CrewMode = 'lean' | 'conservative';
export interface CrewRequirements {
    minCrew: number;
    maxCrew: number;
    multiplier: number;
    mode: CrewMode;
}
export declare function calculateCrewRequirements(crew: number | undefined | null, mode?: CrewMode): CrewRequirements;
export declare function resolveShipCrew(ship: {
    crew?: number | null;
    maxCrew?: number | null;
}): number;
export declare function calculateCrewFromRequirements(requirements: ReadonlyArray<{
    requirementType: string;
    count: number;
    crewPerShip?: number;
    avgCrewPerShip?: number;
}>): number;
//# sourceMappingURL=crewCalculation.d.ts.map