import { MigrationInterface, QueryRunner } from 'typeorm';
export declare class MakeShipOrgIdNullable1804000000000 implements MigrationInterface {
    private readonly tables;
    private findOrganizationColumnName;
    up(queryRunner: QueryRunner): Promise<void>;
    down(queryRunner: QueryRunner): Promise<void>;
}
//# sourceMappingURL=1804000000000-MakeShipOrgIdNullable.d.ts.map