import { Response } from 'express';
import { ObjectLiteral, SelectQueryBuilder } from 'typeorm';
export interface CSVColumn<T = unknown> {
    header: string;
    key: string;
    value?: (row: T) => string | number | boolean | null | undefined;
}
export declare function streamCSV<T extends ObjectLiteral>(res: Response, queryBuilder: SelectQueryBuilder<T>, columns: CSVColumn<T>[], filename?: string, maxRows?: number): Promise<void>;
//# sourceMappingURL=csvExport.d.ts.map