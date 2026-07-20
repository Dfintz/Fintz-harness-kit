import { MigrationInterface, QueryRunner } from 'typeorm';
export declare class AddScaleOptimizationIndexes1844000000000 implements MigrationInterface {
    name: string;
    private quoteIdentifier;
    private resolveColumnName;
    private resolveRequiredColumns;
    private createIndexIfColumnsExist;
    up(queryRunner: QueryRunner): Promise<void>;
    down(queryRunner: QueryRunner): Promise<void>;
}
//# sourceMappingURL=1844000000000-AddScaleOptimizationIndexes.d.ts.map