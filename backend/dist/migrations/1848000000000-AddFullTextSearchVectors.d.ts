import { MigrationInterface, QueryRunner } from 'typeorm';
export declare class AddFullTextSearchVectors1848000000000 implements MigrationInterface {
    name: string;
    private quoteIdentifier;
    private resolveColumnName;
    up(queryRunner: QueryRunner): Promise<void>;
    down(queryRunner: QueryRunner): Promise<void>;
    private addSearchVector;
}
//# sourceMappingURL=1848000000000-AddFullTextSearchVectors.d.ts.map