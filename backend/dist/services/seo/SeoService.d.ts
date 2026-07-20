export interface OpenGraphMeta {
    title: string;
    description: string;
    type: 'website' | 'article' | 'profile';
    url: string;
    image?: string;
    siteName: string;
    locale?: string;
}
export interface TwitterCardMeta {
    card: 'summary' | 'summary_large_image';
    title: string;
    description: string;
    image?: string;
}
export interface OrganizationSchema {
    '@context': 'https://schema.org';
    '@type': 'Organization';
    name: string;
    description?: string;
    url?: string;
    logo?: string;
    foundingDate?: string;
    memberOf?: Array<{
        '@type': 'Organization';
        name: string;
    }>;
    numberOfEmployees?: {
        '@type': 'QuantitativeValue';
        value: number;
    };
    sameAs?: string[];
    knowsLanguage?: string[];
}
export interface WebSiteSchema {
    '@context': 'https://schema.org';
    '@type': 'WebSite';
    name: string;
    url: string;
    description: string;
    potentialAction?: {
        '@type': 'SearchAction';
        target: string;
        'query-input': string;
    };
}
export interface SitemapEntry {
    loc: string;
    lastmod?: string;
    changefreq?: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never';
    priority?: number;
}
export interface SEOMetadata {
    title: string;
    description: string;
    canonicalUrl: string;
    openGraph: OpenGraphMeta;
    twitterCard: TwitterCardMeta;
    jsonLd: OrganizationSchema | WebSiteSchema | object;
}
export declare class SeoService {
    private readonly profileRepository;
    private readonly organizationRepository;
    private readonly activityRepository;
    private readonly jobListingService;
    private readonly federationService;
    constructor();
    private getBaseUrl;
    private getDefaultImage;
    private getFocusDescription;
    private truncateDescription;
    private buildRouteMetadata;
    private buildJobDescription;
    private buildActivityDescription;
    getJobListingMeta(jobIdentifier: string): Promise<SEOMetadata | null>;
    getPublicActivityMeta(activityId: string): Promise<SEOMetadata | null>;
    getJoinActivityLandingMeta(): SEOMetadata;
    getJoinActivityMeta(token: string): Promise<SEOMetadata>;
    getDirectoryHomeMeta(): SEOMetadata;
    getDirectoryOrganizationsMeta(): SEOMetadata;
    getDirectoryAlliancesMeta(): SEOMetadata;
    getDirectoryOpportunitiesMeta(): SEOMetadata;
    getOrganizationMeta(organizationId: string): Promise<SEOMetadata | null>;
    getFederationMeta(federationId: string): Promise<SEOMetadata | null>;
    getHomePageMeta(): SEOMetadata;
    getWelcomePageMeta(): SEOMetadata;
    getOpportunitiesListMeta(): SEOMetadata;
    getPublicStatsPageMeta(): SEOMetadata;
    getChangelogPageMeta(): SEOMetadata;
    getMobileDownloadPageMeta(): SEOMetadata;
    getFleetManagementLandingMeta(): SEOMetadata;
    getOrgManagementLandingMeta(): SEOMetadata;
    getTradeLogisticsLandingMeta(): SEOMetadata;
    getDiscordIntegrationLandingMeta(): SEOMetadata;
    getHelpPageMeta(): SEOMetadata;
    getBotCommandsPageMeta(): SEOMetadata;
    generateSitemap(): Promise<SitemapEntry[]>;
    generateSitemapXml(): Promise<string>;
    private escapeXml;
}
//# sourceMappingURL=SeoService.d.ts.map