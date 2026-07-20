export interface GenericCsvPreview {
    columns: string[];
    rowCount: number;
    sampleRows: Record<string, string>[];
}
export declare class GenericCsvPreviewService {
    parsePreview(csvData: string): GenericCsvPreview;
}
//# sourceMappingURL=GenericCsvPreviewService.d.ts.map