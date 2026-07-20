"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SeoService = void 0;
const data_source_1 = require("../../data-source");
const Activity_1 = require("../../models/Activity");
const Organization_1 = require("../../models/Organization");
const PublicOrgProfile_1 = require("../../models/PublicOrgProfile");
const redis_1 = require("../../utils/redis");
const OrganizationFederationService_1 = require("../organization/OrganizationFederationService");
const PublicJobListingService_1 = require("../organization/PublicJobListingService");
const SITE_NAME = 'Star Citizen Fleet Manager';
const SITE_DESCRIPTION = 'Discover and connect with Star Citizen organizations. Find crews, join alliances, and explore the verse together.';
class SeoService {
    profileRepository;
    organizationRepository;
    activityRepository;
    jobListingService;
    federationService;
    constructor() {
        this.profileRepository = data_source_1.AppDataSource.getRepository(PublicOrgProfile_1.PublicOrgProfile);
        this.organizationRepository = data_source_1.AppDataSource.getRepository(Organization_1.Organization);
        this.activityRepository = data_source_1.AppDataSource.getRepository(Activity_1.Activity);
        this.jobListingService = new PublicJobListingService_1.PublicJobListingService();
        this.federationService = OrganizationFederationService_1.OrganizationFederationService.getInstance();
    }
    getBaseUrl() {
        return process.env.PUBLIC_URL || process.env.FRONTEND_URL || 'https://fringecore.space';
    }
    getDefaultImage() {
        return `${this.getBaseUrl()}/og-image.png`;
    }
    getFocusDescription(focus) {
        const descriptions = {
            combat: 'combat operations',
            mining: 'mining operations',
            trading: 'trading and commerce',
            exploration: 'exploration missions',
            bounty_hunting: 'bounty hunting',
            medical: 'medical support',
            transport: 'transport services',
            salvage: 'salvage operations',
            security: 'security services',
            social: 'social activities',
            piracy: 'pirate activities',
            racing: 'racing events',
            mixed: 'diverse activities',
        };
        return descriptions[focus] || 'various activities';
    }
    truncateDescription(value, maxLength = 160) {
        return value.length > maxLength ? `${value.slice(0, maxLength - 3)}...` : value;
    }
    buildRouteMetadata(title, description, canonicalPath, jsonLd) {
        const baseUrl = this.getBaseUrl();
        const canonicalUrl = `${baseUrl}${canonicalPath}`;
        const safeDescription = this.truncateDescription(description);
        return {
            title,
            description: safeDescription,
            canonicalUrl,
            openGraph: {
                title,
                description: safeDescription,
                type: 'article',
                url: canonicalUrl,
                image: this.getDefaultImage(),
                siteName: SITE_NAME,
            },
            twitterCard: {
                card: 'summary_large_image',
                title,
                description: safeDescription,
                image: this.getDefaultImage(),
            },
            jsonLd,
        };
    }
    buildJobDescription(job) {
        if (job.description?.trim()) {
            return job.description;
        }
        const owner = job.organizationName || 'an organization';
        return `${job.title} is a ${job.jobType} opportunity posted by ${owner} on ${SITE_NAME}.`;
    }
    buildActivityDescription(activity) {
        if (activity.description?.trim()) {
            return activity.description;
        }
        return `${activity.title} is a public ${activity.activityType} activity on ${SITE_NAME}.`;
    }
    async getJobListingMeta(jobIdentifier) {
        const job = await this.jobListingService.getJobListing(jobIdentifier);
        if (!job) {
            return null;
        }
        const title = `${job.title} | Jobs | ${SITE_NAME}`;
        const description = this.buildJobDescription(job);
        const canonicalPath = `/directory/jobs/${encodeURIComponent(jobIdentifier)}`;
        return this.buildRouteMetadata(title, description, canonicalPath, {
            '@context': 'https://schema.org',
            '@type': 'JobPosting',
            title: job.title,
            description: this.truncateDescription(description),
            hiringOrganization: {
                '@type': 'Organization',
                name: job.organizationName || SITE_NAME,
            },
        });
    }
    async getPublicActivityMeta(activityId) {
        const activity = await this.activityRepository
            .createQueryBuilder('activity')
            .where('activity.id = :id', { id: activityId })
            .andWhere('activity.visibility = :visibility', { visibility: 'public' })
            .getOne();
        if (!activity) {
            return null;
        }
        const title = `${activity.title} | Activity | ${SITE_NAME}`;
        const description = this.buildActivityDescription(activity);
        const canonicalPath = `/opportunities/activities/${activity.id}`;
        return this.buildRouteMetadata(title, description, canonicalPath, {
            '@context': 'https://schema.org',
            '@type': 'Event',
            name: activity.title,
            description: this.truncateDescription(description),
            eventStatus: activity.status,
            startDate: activity.scheduledStartDate?.toISOString(),
            endDate: activity.scheduledEndDate?.toISOString(),
            location: activity.location
                ? {
                    '@type': 'Place',
                    name: activity.location,
                }
                : undefined,
        });
    }
    getJoinActivityLandingMeta() {
        const title = `Join Activity | ${SITE_NAME}`;
        const description = 'Use your invite link to join a Star Citizen activity on Fringe Core.';
        return this.buildRouteMetadata(title, description, '/join/activity', {
            '@context': 'https://schema.org',
            '@type': 'WebPage',
            name: title,
            description,
        });
    }
    async getJoinActivityMeta(token) {
        const activity = await this.activityRepository
            .createQueryBuilder('activity')
            .where("(activity.metadata::jsonb)->>'quickJoinToken' = :token", { token })
            .getOne();
        if (!activity) {
            return this.getJoinActivityLandingMeta();
        }
        if (activity.status === Activity_1.ActivityStatus.CANCELLED ||
            activity.status === Activity_1.ActivityStatus.COMPLETED) {
            return this.getJoinActivityLandingMeta();
        }
        const expiry = activity.metadata?.quickJoinTokenExpiry;
        if (typeof expiry === 'string' && new Date(expiry) < new Date()) {
            return this.getJoinActivityLandingMeta();
        }
        const title = `You're Invited: ${activity.title} | ${SITE_NAME}`;
        const description = this.buildActivityDescription(activity);
        const canonicalPath = `/j/${encodeURIComponent(token)}`;
        return this.buildRouteMetadata(title, description, canonicalPath, {
            '@context': 'https://schema.org',
            '@type': 'Event',
            name: activity.title,
            description: this.truncateDescription(description),
            eventStatus: activity.status,
            startDate: activity.scheduledStartDate?.toISOString(),
        });
    }
    getDirectoryHomeMeta() {
        const baseUrl = this.getBaseUrl();
        const url = `${baseUrl}/directory`;
        return {
            title: `Organization Directory | ${SITE_NAME}`,
            description: SITE_DESCRIPTION,
            canonicalUrl: url,
            openGraph: {
                title: `Star Citizen Organization Directory`,
                description: SITE_DESCRIPTION,
                type: 'website',
                url,
                image: this.getDefaultImage(),
                siteName: SITE_NAME,
            },
            twitterCard: {
                card: 'summary_large_image',
                title: `Star Citizen Organization Directory`,
                description: SITE_DESCRIPTION,
                image: this.getDefaultImage(),
            },
            jsonLd: {
                '@context': 'https://schema.org',
                '@type': 'WebSite',
                name: SITE_NAME,
                url: baseUrl,
                description: SITE_DESCRIPTION,
                potentialAction: {
                    '@type': 'SearchAction',
                    target: `${url}?search={search_term_string}`,
                    'query-input': 'required name=search_term_string',
                },
            },
        };
    }
    getDirectoryOrganizationsMeta() {
        const title = `Star Citizen Organizations Directory | ${SITE_NAME}`;
        const description = 'Browse public Star Citizen organizations, compare focus areas, and discover recruiting crews.';
        return this.buildRouteMetadata(title, description, '/directory/organizations', {
            '@context': 'https://schema.org',
            '@type': 'CollectionPage',
            name: title,
            description,
            url: `${this.getBaseUrl()}/directory/organizations`,
            isPartOf: {
                '@type': 'WebSite',
                name: SITE_NAME,
                url: this.getBaseUrl(),
            },
        });
    }
    getDirectoryAlliancesMeta() {
        const title = `Star Citizen Alliances Directory | ${SITE_NAME}`;
        const description = 'Explore Star Citizen alliances and federation-level communities to find coalition opportunities.';
        return this.buildRouteMetadata(title, description, '/directory/alliances', {
            '@context': 'https://schema.org',
            '@type': 'CollectionPage',
            name: title,
            description,
            url: `${this.getBaseUrl()}/directory/alliances`,
            isPartOf: {
                '@type': 'WebSite',
                name: SITE_NAME,
                url: this.getBaseUrl(),
            },
        });
    }
    getDirectoryOpportunitiesMeta() {
        const title = `Star Citizen Opportunities Directory | ${SITE_NAME}`;
        const description = 'Find Star Citizen jobs and opportunities across public organizations, including mission roles and recruiting posts.';
        return this.buildRouteMetadata(title, description, '/directory/opportunities', {
            '@context': 'https://schema.org',
            '@type': 'CollectionPage',
            name: title,
            description,
            url: `${this.getBaseUrl()}/directory/opportunities`,
            isPartOf: {
                '@type': 'WebSite',
                name: SITE_NAME,
                url: this.getBaseUrl(),
            },
        });
    }
    async getOrganizationMeta(organizationId) {
        const profile = await this.profileRepository.findOne({
            where: { organizationId, isPublic: true },
            relations: ['organization'],
        });
        if (!profile) {
            return null;
        }
        const baseUrl = this.getBaseUrl();
        const url = `${baseUrl}/directory/${organizationId}`;
        const orgName = profile.organization?.name || 'Organization';
        const description = profile.tagline ||
            profile.organization?.description ||
            `${orgName} is a Star Citizen organization focused on ${this.getFocusDescription(profile.primaryFocus)}.`;
        const truncatedDescription = description.length > 160 ? `${description.substring(0, 157)}...` : description;
        const organizationSchema = {
            '@context': 'https://schema.org',
            '@type': 'Organization',
            name: orgName,
            description: truncatedDescription,
            url,
            numberOfEmployees: {
                '@type': 'QuantitativeValue',
                value: profile.memberCount,
            },
        };
        if (profile.organization?.logoUrl) {
            organizationSchema.logo = profile.organization.logoUrl;
        }
        if (profile.rsiUrl) {
            organizationSchema.sameAs = [profile.rsiUrl];
        }
        if (profile.languages && profile.languages.length > 0) {
            organizationSchema.knowsLanguage = profile.languages;
        }
        return {
            title: `${orgName} | ${SITE_NAME}`,
            description: truncatedDescription,
            canonicalUrl: url,
            openGraph: {
                title: orgName,
                description: truncatedDescription,
                type: 'profile',
                url,
                image: profile.organization?.logoUrl || this.getDefaultImage(),
                siteName: SITE_NAME,
            },
            twitterCard: {
                card: 'summary',
                title: orgName,
                description: truncatedDescription,
                image: profile.organization?.logoUrl || this.getDefaultImage(),
            },
            jsonLd: organizationSchema,
        };
    }
    async getFederationMeta(federationId) {
        const federation = await this.federationService.getPublicFederation(federationId);
        if (!federation) {
            return null;
        }
        const baseUrl = this.getBaseUrl();
        const url = `${baseUrl}/directory/federations/${federationId}`;
        const description = federation.description ||
            `${federation.name} is a Star Citizen alliance with ${federation.memberCount} member organizations.`;
        const truncatedDescription = description.length > 160 ? `${description.substring(0, 157)}...` : description;
        return {
            title: `${federation.name} Alliance | ${SITE_NAME}`,
            description: truncatedDescription,
            canonicalUrl: url,
            openGraph: {
                title: `${federation.name} Alliance`,
                description: truncatedDescription,
                type: 'profile',
                url,
                image: this.getDefaultImage(),
                siteName: SITE_NAME,
            },
            twitterCard: {
                card: 'summary',
                title: `${federation.name} Alliance`,
                description: truncatedDescription,
                image: this.getDefaultImage(),
            },
            jsonLd: {
                '@context': 'https://schema.org',
                '@type': 'Organization',
                name: federation.name,
                description: truncatedDescription,
                url,
                numberOfEmployees: {
                    '@type': 'QuantitativeValue',
                    value: federation.memberCount,
                },
                memberOf: federation.memberOrganizations.map(member => ({
                    '@type': 'Organization',
                    name: member.organizationName,
                })),
            },
        };
    }
    getHomePageMeta() {
        const baseUrl = this.getBaseUrl();
        return {
            title: `${SITE_NAME} | Discover Star Citizen Organizations`,
            description: SITE_DESCRIPTION,
            canonicalUrl: baseUrl,
            openGraph: {
                title: SITE_NAME,
                description: SITE_DESCRIPTION,
                type: 'website',
                url: baseUrl,
                image: this.getDefaultImage(),
                siteName: SITE_NAME,
            },
            twitterCard: {
                card: 'summary_large_image',
                title: SITE_NAME,
                description: SITE_DESCRIPTION,
                image: this.getDefaultImage(),
            },
            jsonLd: {
                '@context': 'https://schema.org',
                '@type': 'WebSite',
                name: SITE_NAME,
                url: baseUrl,
                description: SITE_DESCRIPTION,
                potentialAction: {
                    '@type': 'SearchAction',
                    target: `${baseUrl}/directory?q={search_term_string}`,
                    'query-input': 'required name=search_term_string',
                },
            },
        };
    }
    getWelcomePageMeta() {
        const baseUrl = this.getBaseUrl();
        const url = `${baseUrl}/welcome`;
        const title = `Welcome to ${SITE_NAME}`;
        const description = 'Get started with the Star Citizen Fleet Manager and discover amazing organizations.';
        return this.buildRouteMetadata(title, description, '/welcome', {
            '@context': 'https://schema.org',
            '@type': 'WebSite',
            name: SITE_NAME,
            url,
            description,
        });
    }
    getOpportunitiesListMeta() {
        const baseUrl = this.getBaseUrl();
        const url = `${baseUrl}/opportunities`;
        const title = `Opportunities | ${SITE_NAME}`;
        const description = 'Browse upcoming Star Citizen activities and join your next adventure.';
        return this.buildRouteMetadata(title, description, '/opportunities', {
            '@context': 'https://schema.org',
            '@type': 'CollectionPage',
            name: title,
            description,
            url,
        });
    }
    getPublicStatsPageMeta() {
        const baseUrl = this.getBaseUrl();
        const url = `${baseUrl}/public/stats`;
        const title = `Organization Statistics | ${SITE_NAME}`;
        const description = 'View aggregate statistics about Star Citizen organizations and communities.';
        return this.buildRouteMetadata(title, description, '/public/stats', {
            '@context': 'https://schema.org',
            '@type': 'Dataset',
            name: title,
            description,
            url,
        });
    }
    getChangelogPageMeta() {
        const baseUrl = this.getBaseUrl();
        const url = `${baseUrl}/changelog`;
        const title = `Changelog | ${SITE_NAME}`;
        const description = 'View the latest updates and features added to Star Citizen Fleet Manager.';
        return this.buildRouteMetadata(title, description, '/changelog', {
            '@context': 'https://schema.org',
            '@type': 'WebPage',
            name: title,
            description,
            url,
        });
    }
    getMobileDownloadPageMeta() {
        const baseUrl = this.getBaseUrl();
        const url = `${baseUrl}/mobile`;
        const title = `Mobile App | ${SITE_NAME}`;
        const description = 'Download the Star Citizen Fleet Manager mobile app for iOS and Android.';
        return this.buildRouteMetadata(title, description, '/mobile', {
            '@context': 'https://schema.org',
            '@type': 'WebApplication',
            name: title,
            description,
            url,
            applicationCategory: 'SocialNetworkingApplication',
            offers: {
                '@type': 'Offer',
                priceCurrency: 'USD',
                price: '0',
            },
        });
    }
    getFleetManagementLandingMeta() {
        const title = `Star Citizen Fleet Management | ${SITE_NAME}`;
        const description = 'Star Citizen fleet management tools for organization leaders managing ships, crews, and readiness in one platform.';
        return this.buildRouteMetadata(title, description, '/star-citizen-fleet-management', {
            '@context': 'https://schema.org',
            '@type': 'WebApplication',
            name: title,
            description,
            url: `${this.getBaseUrl()}/star-citizen-fleet-management`,
        });
    }
    getOrgManagementLandingMeta() {
        const title = `Star Citizen Org Management | ${SITE_NAME}`;
        const description = 'Star Citizen org management platform for roles, workflows, and organization-level coordination.';
        return this.buildRouteMetadata(title, description, '/star-citizen-org-management', {
            '@context': 'https://schema.org',
            '@type': 'WebApplication',
            name: title,
            description,
            url: `${this.getBaseUrl()}/star-citizen-org-management`,
        });
    }
    getTradeLogisticsLandingMeta() {
        const title = `Star Citizen Trade and Logistics Tools | ${SITE_NAME}`;
        const description = 'Star Citizen trade and logistics tools for route planning, cargo workflows, and coordinated org operations.';
        return this.buildRouteMetadata(title, description, '/star-citizen-trade-logistics-tools', {
            '@context': 'https://schema.org',
            '@type': 'WebApplication',
            name: title,
            description,
            url: `${this.getBaseUrl()}/star-citizen-trade-logistics-tools`,
        });
    }
    getDiscordIntegrationLandingMeta() {
        const title = `Star Citizen Discord Integration Tools | ${SITE_NAME}`;
        const description = 'Star Citizen Discord integration tools for bot commands, communication workflows, and organization coordination.';
        return this.buildRouteMetadata(title, description, '/star-citizen-discord-integration-tools', {
            '@context': 'https://schema.org',
            '@type': 'WebApplication',
            name: title,
            description,
            url: `${this.getBaseUrl()}/star-citizen-discord-integration-tools`,
        });
    }
    getHelpPageMeta() {
        const title = `Help Center | ${SITE_NAME}`;
        const description = 'Public help center and FAQ for Star Citizen org tools, fleet workflows, and Discord integration.';
        return this.buildRouteMetadata(title, description, '/help', {
            '@context': 'https://schema.org',
            '@type': 'WebPage',
            name: title,
            description,
            url: `${this.getBaseUrl()}/help`,
        });
    }
    getBotCommandsPageMeta() {
        const title = `Discord Bot Commands | ${SITE_NAME}`;
        const description = 'Public reference for Star Citizen Discord bot commands used for organization and operations workflows.';
        return this.buildRouteMetadata(title, description, '/bot-commands', {
            '@context': 'https://schema.org',
            '@type': 'WebPage',
            name: title,
            description,
            url: `${this.getBaseUrl()}/bot-commands`,
        });
    }
    async generateSitemap() {
        const baseUrl = this.getBaseUrl();
        const entries = [];
        entries.push({
            loc: baseUrl,
            changefreq: 'daily',
            priority: 1,
        }, {
            loc: `${baseUrl}/directory`,
            changefreq: 'daily',
            priority: 0.9,
        }, {
            loc: `${baseUrl}/directory/organizations`,
            changefreq: 'daily',
            priority: 0.9,
        }, {
            loc: `${baseUrl}/directory/alliances`,
            changefreq: 'daily',
            priority: 0.8,
        }, {
            loc: `${baseUrl}/directory/opportunities`,
            changefreq: 'daily',
            priority: 0.8,
        }, {
            loc: `${baseUrl}/welcome`,
            changefreq: 'weekly',
            priority: 0.7,
        }, {
            loc: `${baseUrl}/opportunities`,
            changefreq: 'daily',
            priority: 0.8,
        }, {
            loc: `${baseUrl}/public/stats`,
            changefreq: 'daily',
            priority: 0.7,
        }, {
            loc: `${baseUrl}/changelog`,
            changefreq: 'weekly',
            priority: 0.6,
        }, {
            loc: `${baseUrl}/mobile`,
            changefreq: 'weekly',
            priority: 0.6,
        }, {
            loc: `${baseUrl}/star-citizen-fleet-management`,
            changefreq: 'weekly',
            priority: 0.8,
        }, {
            loc: `${baseUrl}/star-citizen-org-management`,
            changefreq: 'weekly',
            priority: 0.8,
        }, {
            loc: `${baseUrl}/star-citizen-trade-logistics-tools`,
            changefreq: 'weekly',
            priority: 0.8,
        }, {
            loc: `${baseUrl}/star-citizen-discord-integration-tools`,
            changefreq: 'weekly',
            priority: 0.8,
        }, {
            loc: `${baseUrl}/help`,
            changefreq: 'weekly',
            priority: 0.6,
        }, {
            loc: `${baseUrl}/bot-commands`,
            changefreq: 'weekly',
            priority: 0.6,
        }, {
            loc: `${baseUrl}/join/activity`,
            changefreq: 'daily',
            priority: 0.7,
        }, {
            loc: `${baseUrl}/directory/federations`,
            changefreq: 'daily',
            priority: 0.8,
        }, {
            loc: `${baseUrl}/directory/jobs`,
            changefreq: 'daily',
            priority: 0.8,
        });
        const profiles = await this.profileRepository.find({
            where: { isPublic: true },
            select: ['organizationId', 'updatedAt'],
        });
        for (const profile of profiles) {
            entries.push({
                loc: `${baseUrl}/directory/${profile.organizationId}`,
                lastmod: profile.updatedAt.toISOString().split('T')[0],
                changefreq: 'weekly',
                priority: 0.7,
            });
        }
        const federationsResult = await this.federationService.getPublicFederations({}, { page: 1, limit: 1000 });
        for (const federation of federationsResult.data) {
            entries.push({
                loc: `${baseUrl}/directory/federations/${federation.id}`,
                lastmod: new Date(federation.createdAt).toISOString().split('T')[0],
                changefreq: 'weekly',
                priority: 0.6,
            });
        }
        const activities = await this.activityRepository
            .createQueryBuilder('activity')
            .where('activity.visibility = :visibility', { visibility: 'public' })
            .select(['activity.id', 'activity.updatedAt'])
            .getMany();
        for (const activity of activities) {
            entries.push({
                loc: `${baseUrl}/opportunities/activities/${activity.id}`,
                lastmod: activity.updatedAt.toISOString().split('T')[0],
                changefreq: 'weekly',
                priority: 0.6,
            });
        }
        const jobs = await this.jobListingService.getPublicJobListings(undefined, {
            page: 1,
            limit: 10000,
        });
        for (const job of jobs.data) {
            entries.push({
                loc: `${baseUrl}/directory/jobs/${encodeURIComponent(job.id)}`,
                lastmod: job.postedAt.toISOString().split('T')[0],
                changefreq: 'weekly',
                priority: 0.5,
            });
        }
        return entries;
    }
    async generateSitemapXml() {
        const cacheKey = 'public:sitemap:xml';
        const cached = await redis_1.cache.get(cacheKey);
        if (cached) {
            return cached;
        }
        const entries = await this.generateSitemap();
        let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
        xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';
        for (const entry of entries) {
            xml += '  <url>\n';
            xml += `    <loc>${this.escapeXml(entry.loc)}</loc>\n`;
            if (entry.lastmod) {
                xml += `    <lastmod>${entry.lastmod}</lastmod>\n`;
            }
            if (entry.changefreq) {
                xml += `    <changefreq>${entry.changefreq}</changefreq>\n`;
            }
            if (entry.priority !== undefined) {
                xml += `    <priority>${entry.priority.toFixed(1)}</priority>\n`;
            }
            xml += '  </url>\n';
        }
        xml += '</urlset>';
        await redis_1.cache.set(cacheKey, xml, 3600);
        return xml;
    }
    escapeXml(str) {
        return str
            .replaceAll('&', '&amp;')
            .replaceAll('<', '&lt;')
            .replaceAll('>', '&gt;')
            .replaceAll('"', '&quot;')
            .replaceAll("'", '&apos;');
    }
}
exports.SeoService = SeoService;
//# sourceMappingURL=SeoService.js.map