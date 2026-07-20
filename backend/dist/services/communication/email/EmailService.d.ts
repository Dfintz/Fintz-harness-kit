export interface SendEmailOptions {
    to: string;
    subject: string;
    html: string;
    text?: string;
}
export interface SendEmailResult {
    success: boolean;
    messageId?: string;
    error?: string;
}
export declare class EmailService {
    private static instance;
    private acsClient;
    private smtpTransporter;
    private readonly senderAddress;
    private transport;
    private readonly isTransportOptional;
    private constructor();
    static getInstance(): EmailService;
    static resetInstance(): void;
    private parseAcsConnectionString;
    private initializeTransport;
    isConfigured(): boolean;
    getTransport(): 'acs' | 'smtp' | 'none';
    getSenderAddress(): string;
    send(options: SendEmailOptions): Promise<SendEmailResult>;
    private sendViaAcs;
    private sendViaSmtp;
}
export declare const emailService: EmailService;
//# sourceMappingURL=EmailService.d.ts.map