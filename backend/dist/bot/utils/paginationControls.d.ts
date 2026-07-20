import { ActionRowBuilder, ButtonBuilder } from 'discord.js';
export interface PaginateResult<T> {
    pageItems: T[];
    page: number;
    totalPages: number;
    total: number;
}
export declare function paginate<T>(items: readonly T[], page: number, pageSize: number): PaginateResult<T>;
export interface PaginationRowOptions {
    page: number;
    totalPages: number;
    makeCustomId: (targetPage: number) => string;
    prevLabel?: string;
    nextLabel?: string;
}
export declare function buildPaginationRow(options: PaginationRowOptions): ActionRowBuilder<ButtonBuilder> | null;
//# sourceMappingURL=paginationControls.d.ts.map