import { type ObjectLiteral, SelectQueryBuilder } from 'typeorm';
export declare function resetFullTextSearchCache(): void;
export declare function addFullTextSearch<T extends ObjectLiteral>(qb: SelectQueryBuilder<T>, alias: string, searchTerm: string, ilikeColumns: string[], vectorColumn?: string, paramSuffix?: string): boolean;
export declare function addIlikeSearch<T extends ObjectLiteral>(qb: SelectQueryBuilder<T>, alias: string, searchTerm: string, columns: string[], paramSuffix?: string): void;
//# sourceMappingURL=fullTextSearch.d.ts.map