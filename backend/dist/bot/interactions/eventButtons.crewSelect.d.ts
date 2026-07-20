export declare function getCrewShipIdentifier(ship: {
    id?: string;
    shipId?: string;
    ownerId?: string;
}): string | null;
export declare function buildCrewSelectValue(shipIdentifier: string, index: number): string;
export declare function parseCrewSelectValue(value: string): {
    shipIdentifier: string;
    shipIndex: number | undefined;
};
//# sourceMappingURL=eventButtons.crewSelect.d.ts.map