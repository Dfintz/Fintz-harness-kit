"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrganizationAnalytics = exports.MetricType = exports.AnalyticsPeriod = void 0;
const typeorm_1 = require("typeorm");
const Organization_1 = require("./Organization");
var AnalyticsPeriod;
(function (AnalyticsPeriod) {
    AnalyticsPeriod["DAILY"] = "DAILY";
    AnalyticsPeriod["WEEKLY"] = "WEEKLY";
    AnalyticsPeriod["MONTHLY"] = "MONTHLY";
    AnalyticsPeriod["QUARTERLY"] = "QUARTERLY";
    AnalyticsPeriod["YEARLY"] = "YEARLY";
    AnalyticsPeriod["ALL_TIME"] = "ALL_TIME";
})(AnalyticsPeriod || (exports.AnalyticsPeriod = AnalyticsPeriod = {}));
var MetricType;
(function (MetricType) {
    MetricType["MEMBER_COUNT"] = "MEMBER_COUNT";
    MetricType["ACTIVITY_COUNT"] = "ACTIVITY_COUNT";
    MetricType["ENGAGEMENT_SCORE"] = "ENGAGEMENT_SCORE";
    MetricType["GROWTH_RATE"] = "GROWTH_RATE";
    MetricType["RETENTION_RATE"] = "RETENTION_RATE";
    MetricType["HIERARCHY_DEPTH"] = "HIERARCHY_DEPTH";
    MetricType["PERMISSION_USAGE"] = "PERMISSION_USAGE";
    MetricType["RESOURCE_USAGE"] = "RESOURCE_USAGE";
})(MetricType || (exports.MetricType = MetricType = {}));
let OrganizationAnalytics = class OrganizationAnalytics {
    id;
    organizationId;
    organization;
    period;
    periodStart;
    periodEnd;
    memberStats;
    activityMetrics;
    engagementMetrics;
    growthMetrics;
    hierarchyHealth;
    resourceUsage;
    overallHealthScore;
    comparison;
    alerts;
    recommendations;
    metadata;
    createdAt;
    updatedAt;
    isSnapshot;
    calculateHealthScore() {
        let score = 0;
        let weights = 0;
        if (this.memberStats.memberGrowthRate >= 0) {
            score += Math.min(this.memberStats.memberGrowthRate * 2.5, 25);
        }
        weights += 25;
        score += this.engagementMetrics.engagementScore * 0.3;
        weights += 30;
        const activityScore = Math.min((this.activityMetrics.averageActivitiesPerDay / 10) * 20, 20);
        score += activityScore;
        weights += 20;
        score += this.growthMetrics.retentionRate * 0.15;
        weights += 15;
        score += this.hierarchyHealth.balance * 0.1;
        weights += 10;
        this.overallHealthScore = Math.round((score / weights) * 100);
        return this.overallHealthScore;
    }
    generateAlerts() {
        this.alerts = [];
        if (this.engagementMetrics.engagementScore < 30) {
            this.alerts.push({
                type: 'CRITICAL',
                message: 'Very low member engagement detected',
                metric: 'engagementScore',
                value: this.engagementMetrics.engagementScore,
                threshold: 30,
            });
        }
        if (this.growthMetrics.churnRate > 20) {
            this.alerts.push({
                type: 'WARNING',
                message: 'High member churn rate',
                metric: 'churnRate',
                value: this.growthMetrics.churnRate,
                threshold: 20,
            });
        }
        if (this.memberStats.memberGrowthRate < -5) {
            this.alerts.push({
                type: 'WARNING',
                message: 'Declining membership',
                metric: 'memberGrowthRate',
                value: this.memberStats.memberGrowthRate,
                threshold: -5,
            });
        }
        if (this.hierarchyHealth.balance < 40) {
            this.alerts.push({
                type: 'INFO',
                message: 'Unbalanced organization hierarchy',
                metric: 'hierarchyBalance',
                value: this.hierarchyHealth.balance,
                threshold: 40,
            });
        }
        if (this.resourceUsage.errorRate > 5) {
            this.alerts.push({
                type: 'CRITICAL',
                message: 'High API error rate',
                metric: 'errorRate',
                value: this.resourceUsage.errorRate,
                threshold: 5,
            });
        }
    }
    generateRecommendations() {
        this.recommendations = [];
        if (this.engagementMetrics.engagementScore < 50) {
            this.recommendations.push({
                category: 'Engagement',
                priority: 'HIGH',
                message: 'Increase member engagement through regular events and activities',
                action: 'Schedule weekly events and send activity reminders',
            });
        }
        if (this.memberStats.memberGrowthRate < 5) {
            this.recommendations.push({
                category: 'Growth',
                priority: 'MEDIUM',
                message: 'Boost recruitment efforts',
                action: 'Launch targeted recruitment campaign',
            });
        }
        if (this.growthMetrics.retentionRate < 70) {
            this.recommendations.push({
                category: 'Retention',
                priority: 'HIGH',
                message: 'Improve member retention with onboarding programs',
                action: 'Implement mentorship and onboarding system',
            });
        }
        if (this.hierarchyHealth.depth > 7) {
            this.recommendations.push({
                category: 'Structure',
                priority: 'LOW',
                message: 'Consider flattening deep organizational hierarchy',
                action: 'Review and restructure deep organizational branches',
            });
        }
        if (this.engagementMetrics.dormantMembers > this.memberStats.totalMembers * 0.3) {
            this.recommendations.push({
                category: 'Engagement',
                priority: 'MEDIUM',
                message: 'Re-engage dormant members',
                action: 'Send re-engagement campaign to inactive members',
            });
        }
    }
    compareWithPrevious(previous) {
        if (!previous) {
            this.comparison = null;
            return;
        }
        this.comparison = {
            memberChange: this.calculatePercentageChange(previous.memberStats.totalMembers, this.memberStats.totalMembers),
            activityChange: this.calculatePercentageChange(previous.activityMetrics.totalActivities, this.activityMetrics.totalActivities),
            engagementChange: this.calculatePercentageChange(previous.engagementMetrics.engagementScore, this.engagementMetrics.engagementScore),
            growthChange: this.calculatePercentageChange(previous.growthMetrics.growthRate, this.growthMetrics.growthRate),
        };
    }
    calculatePercentageChange(oldValue, newValue) {
        if (oldValue === 0) {
            return newValue > 0 ? 100 : 0;
        }
        return ((newValue - oldValue) / oldValue) * 100;
    }
    getDashboardSummary() {
        return {
            organizationId: this.organizationId,
            period: this.period,
            periodStart: this.periodStart,
            periodEnd: this.periodEnd,
            healthScore: this.overallHealthScore,
            totalMembers: this.memberStats.totalMembers,
            activeMembers: this.memberStats.activeMembers,
            memberGrowth: this.memberStats.memberGrowthRate,
            totalActivities: this.activityMetrics.totalActivities,
            engagementScore: this.engagementMetrics.engagementScore,
            growthRate: this.growthMetrics.growthRate,
            retentionRate: this.growthMetrics.retentionRate,
            alertCount: this.alerts?.length || 0,
            criticalAlerts: this.alerts?.filter(a => a.type === 'CRITICAL').length || 0,
            comparison: this.comparison,
            topRecommendations: this.recommendations?.slice(0, 3) || [],
        };
    }
};
exports.OrganizationAnalytics = OrganizationAnalytics;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], OrganizationAnalytics.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'uuid' }),
    __metadata("design:type", String)
], OrganizationAnalytics.prototype, "organizationId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => Organization_1.Organization, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'organizationId' }),
    __metadata("design:type", Organization_1.Organization)
], OrganizationAnalytics.prototype, "organization", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'enum',
        enum: AnalyticsPeriod,
        default: AnalyticsPeriod.DAILY,
    }),
    __metadata("design:type", String)
], OrganizationAnalytics.prototype, "period", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamp' }),
    __metadata("design:type", Date)
], OrganizationAnalytics.prototype, "periodStart", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamp' }),
    __metadata("design:type", Date)
], OrganizationAnalytics.prototype, "periodEnd", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'jsonb' }),
    __metadata("design:type", Object)
], OrganizationAnalytics.prototype, "memberStats", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'jsonb' }),
    __metadata("design:type", Object)
], OrganizationAnalytics.prototype, "activityMetrics", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'jsonb' }),
    __metadata("design:type", Object)
], OrganizationAnalytics.prototype, "engagementMetrics", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'jsonb' }),
    __metadata("design:type", Object)
], OrganizationAnalytics.prototype, "growthMetrics", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'jsonb' }),
    __metadata("design:type", Object)
], OrganizationAnalytics.prototype, "hierarchyHealth", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'jsonb' }),
    __metadata("design:type", Object)
], OrganizationAnalytics.prototype, "resourceUsage", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'decimal', precision: 5, scale: 2, default: 0 }),
    __metadata("design:type", Number)
], OrganizationAnalytics.prototype, "overallHealthScore", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'jsonb', nullable: true }),
    __metadata("design:type", Object)
], OrganizationAnalytics.prototype, "comparison", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'jsonb', nullable: true }),
    __metadata("design:type", Object)
], OrganizationAnalytics.prototype, "alerts", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'jsonb', nullable: true }),
    __metadata("design:type", Object)
], OrganizationAnalytics.prototype, "recommendations", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'jsonb', nullable: true }),
    __metadata("design:type", Object)
], OrganizationAnalytics.prototype, "metadata", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], OrganizationAnalytics.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)(),
    __metadata("design:type", Date)
], OrganizationAnalytics.prototype, "updatedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'boolean', default: false }),
    __metadata("design:type", Boolean)
], OrganizationAnalytics.prototype, "isSnapshot", void 0);
exports.OrganizationAnalytics = OrganizationAnalytics = __decorate([
    (0, typeorm_1.Entity)('organization_analytics')
], OrganizationAnalytics);
//# sourceMappingURL=OrganizationAnalytics.js.map