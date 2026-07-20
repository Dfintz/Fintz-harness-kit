import { MigrationInterface, QueryRunner } from 'typeorm';
export declare class FixForeignKeyCascades1770300000001 implements MigrationInterface {
    name: string;
    private resolveColumnName;
    private dropNotNullIfColumnExists;
    private setNotNullIfColumnExists;
    up(queryRunner: QueryRunner): Promise<void>;
    down(queryRunner: QueryRunner): Promise<void>;
    private replaceForeignKey;
}
//# sourceMappingURL=1770300000001-FixForeignKeyCascades.d.ts.map