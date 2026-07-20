import { MigrationInterface, QueryRunner } from 'typeorm';
export declare class AddFkIndexesForFleetTeamCascade1863200000000 implements MigrationInterface {
    name: string;
    private quoteIdentifier;
    private resolveColumnName;
    private createIndexIfColumnExists;
    up(queryRunner: QueryRunner): Promise<void>;
    down(queryRunner: QueryRunner): Promise<void>;
}
//# sourceMappingURL=1863200000000-AddFkIndexesForFleetTeamCascade.d.ts.map