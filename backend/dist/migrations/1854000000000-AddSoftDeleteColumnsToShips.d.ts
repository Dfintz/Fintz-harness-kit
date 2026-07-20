import { MigrationInterface, QueryRunner } from 'typeorm';
export declare class AddSoftDeleteColumnsToShips1854000000000 implements MigrationInterface {
    name: string;
    private quoteIdentifier;
    private resolveShipsColumnName;
    up(queryRunner: QueryRunner): Promise<void>;
    down(queryRunner: QueryRunner): Promise<void>;
}
//# sourceMappingURL=1854000000000-AddSoftDeleteColumnsToShips.d.ts.map