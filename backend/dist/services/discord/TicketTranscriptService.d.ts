import { Client } from 'discord.js';
import { TicketMessage } from '../../models/Ticket';
export interface TicketTranscript {
    ticketNumber: string;
    subject: string;
    category: string;
    creatorName: string;
    createdAt: Date;
    closedAt: Date;
    messageCount: number;
    html: string;
    plainText: string;
}
export declare class TicketTranscriptService {
    private static instance;
    private client;
    static getInstance(): TicketTranscriptService;
    initialize(client: Client): void;
    generateTranscript(ticketNumber: string, subject: string, category: string, creatorName: string, createdAt: Date, messages: TicketMessage[]): TicketTranscript;
    postToChannel(transcriptChannelId: string, transcript: TicketTranscript): Promise<boolean>;
    private buildHtml;
    private buildPlainText;
    private formatDuration;
}
//# sourceMappingURL=TicketTranscriptService.d.ts.map