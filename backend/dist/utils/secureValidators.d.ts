export declare const isSecureURL: (url: string, options?: {
    protocols?: string[];
    require_protocol?: boolean;
    require_host?: boolean;
    allow_fragments?: boolean;
    allow_query_components?: boolean;
    allow_credentials?: boolean;
}) => boolean;
export declare const isPrivateIP: (hostname: string) => boolean;
export declare const isLocalhost: (hostname: string) => boolean;
export declare const sanitizeURL: (url: string) => string;
export declare const isSecureEmail: (email: string) => boolean;
export declare const isSecureDiscordId: (discordId: string) => boolean;
export declare const isSecureDiscordUsername: (username: string) => boolean;
export declare const isSecureFilename: (filename: string) => boolean;
export declare const sanitizeFilename: (filename: string) => string;
export declare const isSecurePhoneNumber: (phone: string) => boolean;
export declare const secureValidators: {
    isSecureURL: (url: string, options?: {
        protocols?: string[];
        require_protocol?: boolean;
        require_host?: boolean;
        allow_fragments?: boolean;
        allow_query_components?: boolean;
        allow_credentials?: boolean;
    }) => boolean;
    sanitizeURL: (url: string) => string;
    isSecureEmail: (email: string) => boolean;
    isSecureDiscordId: (discordId: string) => boolean;
    isSecureDiscordUsername: (username: string) => boolean;
    isSecureFilename: (filename: string) => boolean;
    sanitizeFilename: (filename: string) => string;
    isSecurePhoneNumber: (phone: string) => boolean;
    isPrivateIP: (hostname: string) => boolean;
    isLocalhost: (hostname: string) => boolean;
};
//# sourceMappingURL=secureValidators.d.ts.map