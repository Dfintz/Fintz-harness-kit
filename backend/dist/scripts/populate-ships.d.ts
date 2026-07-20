interface ShipData {
    name: string;
    manufacturer: string;
    role?: string;
    size?: string;
    crew?: number;
    cargo?: number;
    price?: number;
    isVehicle: boolean;
}
declare const loadShipsFromJson: () => ShipData[];
declare const populateShips: () => Promise<void>;
export { loadShipsFromJson, populateShips };
//# sourceMappingURL=populate-ships.d.ts.map