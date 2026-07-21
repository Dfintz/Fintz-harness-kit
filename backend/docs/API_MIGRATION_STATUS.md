# API V1 to V2 Migration Status Report
Generated: 2026-02-05T00:03:11.677Z

## Summary

- **V1 Endpoints:** 707
- **V2 Endpoints:** 887
- **Migrated:** 244 (35%)
- **V1-Only (Need Migration):** 463
- **V2-Only (New Features):** 664

---

## Migration Progress

```
█████████████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ 35%
```

---

## V1 Endpoints Needing Migration (463)


| Method | V1 Path | File | Priority |
|--------|---------|------|----------|
| GET | /my/activities | activityRoutes.ts | 🟢 Low |
| GET | /statistics/overview | activityRoutes.ts | 🟢 Low |
| POST | /:id/join | activityRoutes.ts | 🟢 Low |
| POST | /:id/leave | activityRoutes.ts | 🟢 Low |
| PUT | /:id/participants/:userId | activityRoutes.ts | 🟢 Low |
| POST | /:id/invite-org | activityRoutes.ts | 🟢 Low |
| POST | /:id/accept-invite | activityRoutes.ts | 🟢 Low |
| POST | /:id/decline-invite | activityRoutes.ts | 🟢 Low |
| POST | /:id/voice | activityRoutes.ts | 🟢 Low |
| POST | /:id/voice/link | activityRoutes.ts | 🟢 Low |
| POST | /batch/create | activityRoutes.ts | 🟢 Low |
| POST | /:id/ships | activityRoutes.ts | 🟡 Medium |
| POST | /:id/ships/:ownerId/crew | activityRoutes.ts | 🟡 Medium |
| DELETE | /:id/ships/crew | activityRoutes.ts | 🟡 Medium |
| GET | /:id/ships/available-crew | activityRoutes.ts | 🟡 Medium |
| POST | /:id/route | activityRoutes.ts | 🟢 Low |
| PUT | /:id/route/:order | activityRoutes.ts | 🟢 Low |
| POST | /:id/enrich-mining | activityRoutes.ts | 🟢 Low |
| POST | /:activityId/reminders | activityRoutes.ts | 🟢 Low |
| GET | /:activityId/reminders | activityRoutes.ts | 🟢 Low |
| DELETE | /:activityId/reminders/:reminderId | activityRoutes.ts | 🟢 Low |
| PATCH | /:activityId/reminders/:reminderId | activityRoutes.ts | 🟢 Low |
| PUT | /feature-flags/:id | adminRoutes.ts | 🟢 Low |
| POST | /admin/ships/preview-delta | adminShipRoutes.ts | 🟡 Medium |
| POST | /admin/ships/apply-delta | adminShipRoutes.ts | 🟡 Medium |
| POST | /alliance-diplomacy | allianceDiplomacyRoutes.ts | 🟢 Low |
| GET | /alliance-diplomacy | allianceDiplomacyRoutes.ts | 🟢 Low |
| GET | /alliance-diplomacy/:id | allianceDiplomacyRoutes.ts | 🟢 Low |
| POST | /alliance-diplomacy/:id/approve | allianceDiplomacyRoutes.ts | 🟢 Low |
| POST | /alliance-diplomacy/:id/suspend | allianceDiplomacyRoutes.ts | 🟢 Low |
| POST | /alliance-diplomacy/:id/terminate | allianceDiplomacyRoutes.ts | 🟢 Low |
| POST | /alliance-diplomacy/:id/incidents | allianceDiplomacyRoutes.ts | 🟢 Low |
| PUT | /alliance-diplomacy/:id/incidents/:incidentId/resolve | allianceDiplomacyRoutes.ts | 🟢 Low |
| POST | /activities/:activityId/attendance/initialize | attendanceRoutes.ts | 🟢 Low |
| POST | /activities/:activityId/attendance/confirm | attendanceRoutes.ts | 🟢 Low |
| POST | /activities/:activityId/attendance/record | attendanceRoutes.ts | 🟢 Low |
| POST | /activities/:activityId/attendance/no-show | attendanceRoutes.ts | 🟢 Low |
| POST | /activities/:activityId/attendance/send-requests | attendanceRoutes.ts | 🟢 Low |
| GET | /activities/:activityId/attendance/report | attendanceRoutes.ts | 🟢 Low |
| GET | /users/:userId/attendance/history | attendanceRoutes.ts | 🟢 Low |
| GET | /organizations/:organizationId/attendance/leaderboard | attendanceRoutes.ts | 🔴 High |
| POST | /attendance/:confirmationId/rating | attendanceRoutes.ts | 🟢 Low |
| POST | /briefings | briefingRoutes.ts | 🟢 Low |
| GET | /briefings | briefingRoutes.ts | 🟢 Low |
| GET | /briefings/:id | briefingRoutes.ts | 🟢 Low |
| GET | /briefings/mission/:missionId | briefingRoutes.ts | 🟢 Low |
| PUT | /briefings/:id | briefingRoutes.ts | 🟢 Low |
| DELETE | /briefings/:id | briefingRoutes.ts | 🟢 Low |
| POST | /briefings/:id/elements | briefingRoutes.ts | 🟢 Low |
| PUT | /briefings/:id/elements/:elementId | briefingRoutes.ts | 🟢 Low |
| DELETE | /briefings/:id/elements/:elementId | briefingRoutes.ts | 🟢 Low |
| POST | /briefings/:id/participants | briefingRoutes.ts | 🟢 Low |
| DELETE | /briefings/:id/participants | briefingRoutes.ts | 🟢 Low |
| PUT | /briefings/:id/status | briefingRoutes.ts | 🟢 Low |
| POST | /briefings/:id/version | briefingRoutes.ts | 🟢 Low |
| POST | /cargo-manifests | cargoManifestRoutes.ts | 🟢 Low |
| GET | /cargo-manifests | cargoManifestRoutes.ts | 🟢 Low |
| POST | /directory/contact | contactRequestRoutes.ts | 🟢 Low |
| GET | /directory/contact/options | contactRequestRoutes.ts | 🟢 Low |
| GET | /organizations/:id/contact-requests | contactRequestRoutes.ts | 🔴 High |
| GET | /organizations/:id/contact-requests/stats | contactRequestRoutes.ts | 🔴 High |
| GET | /organizations/:id/contact-requests/:requestId | contactRequestRoutes.ts | 🔴 High |
| PATCH | /organizations/:id/contact-requests/:requestId | contactRequestRoutes.ts | 🔴 High |
| DELETE | /organizations/:id/contact-requests/:requestId | contactRequestRoutes.ts | 🔴 High |
| GET | /federations/:allianceId/contact-requests | contactRequestRoutes.ts | 🟢 Low |
| GET | /federations/:allianceId/contact-requests/stats | contactRequestRoutes.ts | 🟢 Low |
| GET | /federations/:allianceId/contact-requests/:requestId | contactRequestRoutes.ts | 🟢 Low |
| PATCH | /federations/:allianceId/contact-requests/:requestId | contactRequestRoutes.ts | 🟢 Low |
| DELETE | /federations/:allianceId/contact-requests/:requestId | contactRequestRoutes.ts | 🟢 Low |
| POST | /crew-assignments | crewAssignmentRoutes.ts | 🟢 Low |
| GET | /crew-assignments | crewAssignmentRoutes.ts | 🟢 Low |
| GET | /crew-assignments/:id | crewAssignmentRoutes.ts | 🟢 Low |
| POST | /crew-assignments/:id/crew | crewAssignmentRoutes.ts | 🟢 Low |
| DELETE | /crew-assignments/:id/crew/:userId | crewAssignmentRoutes.ts | 🟢 Low |
| PUT | /crew-assignments/:id/status | crewAssignmentRoutes.ts | 🟢 Low |
| GET | /discord/roles/:guildId/:userId | discordRoutes.ts | 🟢 Low |
| POST | /discord/roles/:guildId/:userId | discordRoutes.ts | 🟢 Low |
| DELETE | /discord/roles/:guildId/:userId | discordRoutes.ts | 🟢 Low |
| GET | /me | eventConflictRoutes.ts | 🟢 Low |
| GET | /activity/:activityId | eventConflictRoutes.ts | 🟢 Low |
| GET | /range | eventConflictRoutes.ts | 🟢 Low |
| POST | /events/:id/attendees | eventRoutes.ts | 🟡 Medium |
| DELETE | /events/:id/attendees | eventRoutes.ts | 🟡 Medium |
| POST | /events/recurring | eventRoutes.ts | 🟡 Medium |
| POST | /inventory | fleetLogisticsAdvancedRoutes.ts | 🟢 Low |
| GET | /inventory | fleetLogisticsAdvancedRoutes.ts | 🟢 Low |
| GET | /inventory/:id | fleetLogisticsAdvancedRoutes.ts | 🟢 Low |
| PATCH | /inventory/:id | fleetLogisticsAdvancedRoutes.ts | 🟢 Low |
| DELETE | /inventory/:id | fleetLogisticsAdvancedRoutes.ts | 🟢 Low |
| POST | /inventory/:id/adjust | fleetLogisticsAdvancedRoutes.ts | 🟢 Low |
| GET | /inventory/fleet/:fleetId/statistics | fleetLogisticsAdvancedRoutes.ts | 🟢 Low |
| GET | /inventory/fleet/:fleetId/by-category | fleetLogisticsAdvancedRoutes.ts | 🟢 Low |
| GET | /inventory/fleet/:fleetId/low-stock-report | fleetLogisticsAdvancedRoutes.ts | 🟢 Low |
| POST | /logistics/alerts | fleetLogisticsAdvancedRoutes.ts | 🟢 Low |
| GET | /logistics/alerts | fleetLogisticsAdvancedRoutes.ts | 🟢 Low |
| GET | /logistics/alerts/:id | fleetLogisticsAdvancedRoutes.ts | 🟢 Low |
| PATCH | /logistics/alerts/:id | fleetLogisticsAdvancedRoutes.ts | 🟢 Low |
| DELETE | /logistics/alerts/:id | fleetLogisticsAdvancedRoutes.ts | 🟢 Low |
| POST | /logistics/alerts/:id/acknowledge | fleetLogisticsAdvancedRoutes.ts | 🟢 Low |
| POST | /logistics/alerts/:id/resolve | fleetLogisticsAdvancedRoutes.ts | 🟢 Low |
| POST | /logistics/alerts/:id/dismiss | fleetLogisticsAdvancedRoutes.ts | 🟢 Low |
| POST | /logistics/alerts/check-inventory | fleetLogisticsAdvancedRoutes.ts | 🟢 Low |
| POST | /logistics/alerts/auto-resolve | fleetLogisticsAdvancedRoutes.ts | 🟢 Low |
| GET | /logistics/alerts/fleet/:fleetId/statistics | fleetLogisticsAdvancedRoutes.ts | 🟢 Low |
| GET | /logistics/dashboard/:fleetId | fleetLogisticsAdvancedRoutes.ts | 🟢 Low |
| GET | /logistics/dashboard/:fleetId/categories | fleetLogisticsAdvancedRoutes.ts | 🟢 Low |
| GET | /logistics/dashboard/:fleetId/alert-summary | fleetLogisticsAdvancedRoutes.ts | 🟢 Low |
| GET | /logistics/dashboard/:fleetId/operations | fleetLogisticsAdvancedRoutes.ts | 🟢 Low |
| GET | /logistics/dashboard/:fleetId/supplier-performance | fleetLogisticsAdvancedRoutes.ts | 🟢 Low |
| GET | /logistics/dashboard/:fleetId/consumption | fleetLogisticsAdvancedRoutes.ts | 🟢 Low |
| GET | /logistics/dashboard/:fleetId/stock-value-trend | fleetLogisticsAdvancedRoutes.ts | 🟢 Low |
| POST | /logistics/integrations | fleetLogisticsAdvancedRoutes.ts | 🟢 Low |
| GET | /logistics/integrations/fleet/:fleetId | fleetLogisticsAdvancedRoutes.ts | 🟢 Low |
| GET | /logistics/integrations/:id | fleetLogisticsAdvancedRoutes.ts | 🟢 Low |
| PATCH | /logistics/integrations/:id | fleetLogisticsAdvancedRoutes.ts | 🟢 Low |
| DELETE | /logistics/integrations/:id | fleetLogisticsAdvancedRoutes.ts | 🟢 Low |
| POST | /logistics/integrations/:id/test | fleetLogisticsAdvancedRoutes.ts | 🟢 Low |
| POST | /logistics/integrations/:id/sync | fleetLogisticsAdvancedRoutes.ts | 🟢 Low |
| POST | /logistics/integrations/:id/webhook | fleetLogisticsAdvancedRoutes.ts | 🟢 Low |
| POST | /fleet-logistics | fleetLogisticsRoutes.ts | 🟢 Low |
| GET | /fleet-logistics | fleetLogisticsRoutes.ts | 🟢 Low |
| GET | /fleet-logistics/:id | fleetLogisticsRoutes.ts | 🟢 Low |
| PUT | /fleet-logistics/:id | fleetLogisticsRoutes.ts | 🟢 Low |
| PUT | /fleet-logistics/:id/status | fleetLogisticsRoutes.ts | 🟢 Low |
| GET | /fleet-logistics/:id/fuel-requirements | fleetLogisticsRoutes.ts | 🟢 Low |
| GET | /fleet-logistics/:id/cargo-capacity | fleetLogisticsRoutes.ts | 🟢 Low |
| GET | /fleet-logistics/:id/jump-range | fleetLogisticsRoutes.ts | 🟢 Low |
| DELETE | /fleet-logistics/:id | fleetLogisticsRoutes.ts | 🟢 Low |
| GET | /fleet | fleetRoutes.ts | 🟢 Low |
| POST | /fleet/member | fleetRoutes.ts | 🟢 Low |
| DELETE | /fleet/member/:id | fleetRoutes.ts | 🟢 Low |
| POST | /fleet/upload | fleetRoutes.ts | 🟢 Low |
| GET | /fleet/:fleetId/members | fleetRoutes.ts | 🟢 Low |
| GET | /fleet/members/:memberId | fleetRoutes.ts | 🟢 Low |
| POST | /fleet/:fleetId/members | fleetRoutes.ts | 🟢 Low |
| PATCH | /fleet/members/:memberId | fleetRoutes.ts | 🟢 Low |
| DELETE | /fleet/members/:memberId | fleetRoutes.ts | 🟢 Low |
| POST | /fleet/:fleetId/members/bulk | fleetRoutes.ts | 🟢 Low |
| PATCH | /fleet/members/bulk | fleetRoutes.ts | 🟢 Low |
| DELETE | /fleet/members/bulk | fleetRoutes.ts | 🟢 Low |
| PATCH | /fleet/members/bulk/status | fleetRoutes.ts | 🟢 Low |
| GET | /fleet/:fleetId/analytics/composition | fleetRoutes.ts | 🟢 Low |
| GET | /fleet/:fleetId/analytics/activity | fleetRoutes.ts | 🟢 Low |
| GET | /fleet/:fleetId/analytics/trends | fleetRoutes.ts | 🟢 Low |
| GET | /fleet/:fleetId/analytics/roles | fleetRoutes.ts | 🟢 Low |
| GET | /fleet/:fleetId/analytics/ships | fleetRoutes.ts | 🟡 Medium |
| GET | /fleet/:fleetId/analytics/heatmap | fleetRoutes.ts | 🟢 Low |
| POST | /fleet/analytics/compare | fleetRoutes.ts | 🟢 Low |
| GET | /shared | fleetRoutesTenant.ts | 🟢 Low |
| POST | /:id/unshare | fleetRoutesTenant.ts | 🟢 Low |
| GET | /fleet/export/user | fleetViewRoutes.ts | 🟢 Low |
| GET | /fleet/export/org/:organizationId | fleetViewRoutes.ts | 🟢 Low |
| POST | /fleet/import/user | fleetViewRoutes.ts | 🟢 Low |
| POST | /fleet/import/org/:organizationId | fleetViewRoutes.ts | 🟢 Low |
| POST | /fleet/validate | fleetViewRoutes.ts | 🟢 Low |
| POST | /images/upload | imageRoutes.ts | 🟢 Low |
| GET | /images/download/:fileName | imageRoutes.ts | 🟢 Low |
| GET | /images/url/:fileName | imageRoutes.ts | 🟢 Low |
| DELETE | /images/:fileName | imageRoutes.ts | 🟢 Low |
| GET | /images | imageRoutes.ts | 🟢 Low |
| GET | /organizations/:orgId/intel/access | intelVaultRoutes.ts | 🔴 High |
| POST | /organizations/:orgId/intel/entries | intelVaultRoutes.ts | 🔴 High |
| GET | /organizations/:orgId/intel/entries | intelVaultRoutes.ts | 🔴 High |
| GET | /organizations/:orgId/intel/entries/:entryId | intelVaultRoutes.ts | 🔴 High |
| PATCH | /organizations/:orgId/intel/entries/:entryId | intelVaultRoutes.ts | 🔴 High |
| DELETE | /organizations/:orgId/intel/entries/:entryId | intelVaultRoutes.ts | 🔴 High |
| POST | /organizations/:orgId/intel/officers | intelVaultRoutes.ts | 🔴 High |
| GET | /organizations/:orgId/intel/officers | intelVaultRoutes.ts | 🔴 High |
| GET | /organizations/:orgId/intel/officers/:officerId | intelVaultRoutes.ts | 🔴 High |
| PATCH | /organizations/:orgId/intel/officers/:officerId | intelVaultRoutes.ts | 🔴 High |
| DELETE | /organizations/:orgId/intel/officers/:officerId | intelVaultRoutes.ts | 🔴 High |
| GET | /organizations/:orgId/intel/audit-logs | intelVaultRoutes.ts | 🔴 High |
| POST | /mining-operations | miningOperationRoutes.ts | 🟢 Low |
| GET | /mining-operations | miningOperationRoutes.ts | 🟢 Low |
| GET | /mining-operations/:id | miningOperationRoutes.ts | 🟢 Low |
| POST | /mining-operations/:id/crew | miningOperationRoutes.ts | 🟢 Low |
| POST | /mining-operations/:id/resources | miningOperationRoutes.ts | 🟢 Low |
| PUT | /mining-operations/:id/status | miningOperationRoutes.ts | 🟢 Low |
| GET | /organizations/search | organizationRoutes.ts | 🔴 High |
| GET | /organizations/:id | organizationRoutes.ts | 🔴 High |
| POST | /organizations | organizationRoutes.ts | 🔴 High |
| PATCH | /organizations/:id | organizationRoutes.ts | 🔴 High |
| GET | /organizations/:id/deletion-preview | organizationRoutes.ts | 🔴 High |
| GET | /organizations/:id/deletion-requests/latest | organizationRoutes.ts | 🔴 High |
| DELETE | /organizations/:id | organizationRoutes.ts | 🔴 High |
| POST | /organizations/:id/sub-organizations | organizationRoutes.ts | 🔴 High |
| PATCH | /organizations/:id/move | organizationRoutes.ts | 🔴 High |
| POST | /organizations/:id/detach | organizationRoutes.ts | 🔴 High |
| GET | /organizations/:id/tree | organizationRoutes.ts | 🔴 High |
| GET | /organizations/:id/ancestors | organizationRoutes.ts | 🔴 High |
| GET | /organizations/:id/descendants | organizationRoutes.ts | 🔴 High |
| GET | /organizations/:id/siblings | organizationRoutes.ts | 🔴 High |
| GET | /organizations/:id/validate | organizationRoutes.ts | 🔴 High |
| GET | /organizations/:id/hierarchy/stats | organizationRoutes.ts | 🔴 High |
| POST | /organizations/:id/members | organizationRoutes.ts | 🔴 High |
| DELETE | /organizations/:id/members/:userId | organizationRoutes.ts | 🔴 High |
| PATCH | /organizations/:id/members/:userId/role | organizationRoutes.ts | 🔴 High |
| POST | /organizations/:id/members/:userId/transfer | organizationRoutes.ts | 🔴 High |
| PATCH | /organizations/:id/permissions/:permissionId | organizationRoutes.ts | 🔴 High |
| POST | /organizations/:id/permissions/template | organizationRoutes.ts | 🔴 High |
| GET | /organizations/:id/permissions/stats | organizationRoutes.ts | 🔴 High |
| GET | /organizations/:id/activity | organizationRoutes.ts | 🔴 High |
| GET | /organizations/:id/activity/stats | organizationRoutes.ts | 🔴 High |
| GET | /organizations/:id/analytics/dashboard | organizationRoutes.ts | 🔴 High |
| GET | /organizations/:id/analytics/members | organizationRoutes.ts | 🔴 High |
| GET | /organizations/:id/analytics/activity | organizationRoutes.ts | 🔴 High |
| GET | /organizations/:id/analytics/growth | organizationRoutes.ts | 🔴 High |
| GET | /organizations/:id/analytics/export | organizationRoutes.ts | 🔴 High |
| GET | /organizations/templates/marketplace | organizationRoutes.ts | 🔴 High |
| GET | /organizations/templates/popular | organizationRoutes.ts | 🔴 High |
| GET | /organizations/templates/top-rated | organizationRoutes.ts | 🔴 High |
| POST | /organizations/templates/import | organizationRoutes.ts | 🔴 High |
| POST | /organizations/templates | organizationRoutes.ts | 🔴 High |
| GET | /organizations/templates | organizationRoutes.ts | 🔴 High |
| GET | /organizations/templates/:id | organizationRoutes.ts | 🔴 High |
| PUT | /organizations/templates/:id | organizationRoutes.ts | 🔴 High |
| DELETE | /organizations/templates/:id | organizationRoutes.ts | 🔴 High |
| POST | /organizations/templates/:id/apply | organizationRoutes.ts | 🔴 High |
| POST | /organizations/templates/:id/fork | organizationRoutes.ts | 🔴 High |
| POST | /organizations/templates/:id/rate | organizationRoutes.ts | 🔴 High |
| GET | /organizations/templates/:id/export | organizationRoutes.ts | 🔴 High |
| POST | /organizations/:id/bulk/add-members | organizationRoutes.ts | 🔴 High |
| POST | /organizations/:id/bulk/remove-members | organizationRoutes.ts | 🔴 High |
| POST | /organizations/:id/bulk/update-roles | organizationRoutes.ts | 🔴 High |
| POST | /organizations/:id/bulk/grant-permissions | organizationRoutes.ts | 🔴 High |
| POST | /organizations/:id/bulk/revoke-permissions | organizationRoutes.ts | 🔴 High |
| POST | /organizations/:id/bulk/import | organizationRoutes.ts | 🔴 High |
| GET | /organizations/:id/bulk/export | organizationRoutes.ts | 🔴 High |
| GET | /organizations/:id/bulk/stats | organizationRoutes.ts | 🔴 High |
| POST | /organizations/:id/discord/connect | organizationRoutes.ts | 🔴 High |
| DELETE | /organizations/:id/discord/disconnect/:guildId | organizationRoutes.ts | 🔴 High |
| GET | /organizations/:id/discord/guilds | organizationRoutes.ts | 🔴 High |
| GET | /organizations/:orgId/ships | organizationShipRoutes.ts | 🔴 High |
| GET | /organizations/:orgId/ships/summary | organizationShipRoutes.ts | 🔴 High |
| GET | /organizations/:orgId/ships/:shipId | organizationShipRoutes.ts | 🔴 High |
| POST | /organizations/:orgId/ships | organizationShipRoutes.ts | 🔴 High |
| PATCH | /organizations/:orgId/ships/:shipId | organizationShipRoutes.ts | 🔴 High |
| DELETE | /organizations/:orgId/ships/:shipId | organizationShipRoutes.ts | 🔴 High |
| POST | /organizations/:orgId/ships/:shipId/captain | organizationShipRoutes.ts | 🔴 High |
| POST | /organizations/:orgId/ships/:shipId/crew | organizationShipRoutes.ts | 🔴 High |
| POST | /organizations/:orgId/ships/:shipId/crew/:userId | organizationShipRoutes.ts | 🔴 High |
| DELETE | /organizations/:orgId/ships/:shipId/crew/:userId | organizationShipRoutes.ts | 🔴 High |
| GET | /organizations/:orgId/ships/maintenance/due | organizationShipRoutes.ts | 🔴 High |
| GET | /organizations/:orgId/ships/capital | organizationShipRoutes.ts | 🔴 High |
| GET | /organizations/:orgId/ships/role/:role | organizationShipRoutes.ts | 🔴 High |
| GET | /organizations/:orgId/ships/available | organizationShipRoutes.ts | 🔴 High |
| POST | /orgs/relationships | orgRelationshipRoutes.ts | 🟡 Medium |
| GET | /orgs/:orgId/relationships | orgRelationshipRoutes.ts | 🟡 Medium |
| GET | /report | performanceRoutes.ts | 🟢 Low |
| GET | /history | performanceRoutes.ts | 🟢 Low |
| GET | /database | performanceRoutes.ts | 🟢 Low |
| GET | /database/indices | performanceRoutes.ts | 🟢 Low |
| GET | /database/tables | performanceRoutes.ts | 🟢 Low |
| GET | /cache | performanceRoutes.ts | 🟢 Low |
| GET | /cache/keys | performanceRoutes.ts | 🟢 Low |
| POST | /cache/warm | performanceRoutes.ts | 🟢 Low |
| POST | /cache/invalidate | performanceRoutes.ts | 🟢 Low |
| GET | /thresholds | performanceRoutes.ts | 🟢 Low |
| PUT | /thresholds | performanceRoutes.ts | 🟢 Low |
| GET | /organizations/:organizationId/permissions/:resource/:action/users | permissionRoutes.ts | 🔴 High |
| GET | /permission-templates | permissionTemplateRoutes.ts | 🟢 Low |
| GET | /permission-templates/:templateId | permissionTemplateRoutes.ts | 🟢 Low |
| POST | /permission-templates | permissionTemplateRoutes.ts | 🟢 Low |
| PUT | /permission-templates/:templateId | permissionTemplateRoutes.ts | 🟢 Low |
| DELETE | /permission-templates/:templateId | permissionTemplateRoutes.ts | 🟢 Low |
| POST | /permission-templates/:templateId/apply | permissionTemplateRoutes.ts | 🟢 Low |
| GET | /permission-templates/usage/:userId | permissionTemplateRoutes.ts | 🟢 Low |
| GET | /permission-templates/reports/:organizationId | permissionTemplateRoutes.ts | 🟢 Low |
| GET | /permission-templates/audit | permissionTemplateRoutes.ts | 🟢 Low |
| GET | /permission-templates/stats | permissionTemplateRoutes.ts | 🟢 Low |
| GET | /directory | publicDirectoryRoutes.ts | 🟢 Low |
| GET | /directory/stats | publicDirectoryRoutes.ts | 🟢 Low |
| GET | /directory/options | publicDirectoryRoutes.ts | 🟢 Low |
| GET | /directory/:organizationId/seo | publicDirectoryRoutes.ts | 🟢 Low |
| GET | /directory/:organizationId | publicDirectoryRoutes.ts | 🟢 Low |
| GET | /sitemap.xml | publicDirectoryRoutes.ts | 🟢 Low |
| GET | /organizations/:id/public-profile | publicDirectoryRoutes.ts | 🔴 High |
| PATCH | /organizations/:id/public-profile | publicDirectoryRoutes.ts | 🔴 High |
| PATCH | /admin/directory/:organizationId/verify | publicDirectoryRoutes.ts | 🟢 Low |
| GET | /organizations/:id/jobs | publicJobListingRoutes.ts | 🔴 High |
| POST | /organizations/:id/jobs | publicJobListingRoutes.ts | 🔴 High |
| POST | /federations/:id/jobs | publicJobListingRoutes.ts | 🟢 Low |
| PATCH | /jobs/:jobId | publicJobListingRoutes.ts | 🟢 Low |
| DELETE | /jobs/:jobId | publicJobListingRoutes.ts | 🟢 Low |
| POST | /next-occurrence | recurringActivityRoutes.ts | 🟢 Low |
| POST | /occurrences | recurringActivityRoutes.ts | 🟢 Low |
| POST | /parse | recurringActivityRoutes.ts | 🟢 Low |
| POST | /format | recurringActivityRoutes.ts | 🟢 Low |
| POST | /create-instances | recurringActivityRoutes.ts | 🟢 Low |
| POST | /preview | recurringActivityRoutes.ts | 🟢 Low |
| GET | /frequencies | recurringActivityRoutes.ts | 🟢 Low |
| GET | /reputation/:userId | reputationRoutes.ts | 🟢 Low |
| PUT | /reputation/:userId | reputationRoutes.ts | 🟢 Low |
| GET | /reputation/top | reputationRoutes.ts | 🟢 Low |
| GET | /rsi-role-mappings/templates | rsiRoleMappingRoutes.ts | 🟢 Low |
| GET | /rsi-role-mappings/templates/:templateName | rsiRoleMappingRoutes.ts | 🟢 Low |
| GET | /organizations/:organizationId/rsi-role-mappings | rsiRoleMappingRoutes.ts | 🔴 High |
| GET | /organizations/:organizationId/rsi-role-mappings/summary | rsiRoleMappingRoutes.ts | 🔴 High |
| GET | /organizations/:organizationId/rsi-role-mappings/:id | rsiRoleMappingRoutes.ts | 🔴 High |
| POST | /organizations/:organizationId/rsi-role-mappings | rsiRoleMappingRoutes.ts | 🔴 High |
| POST | /organizations/:organizationId/rsi-role-mappings/apply-template | rsiRoleMappingRoutes.ts | 🔴 High |
| POST | /organizations/:organizationId/rsi-role-mappings/bulk | rsiRoleMappingRoutes.ts | 🔴 High |
| POST | /organizations/:organizationId/rsi-role-mappings/clone | rsiRoleMappingRoutes.ts | 🔴 High |
| PUT | /organizations/:organizationId/rsi-role-mappings/:id | rsiRoleMappingRoutes.ts | 🔴 High |
| DELETE | /organizations/:organizationId/rsi-role-mappings/:id | rsiRoleMappingRoutes.ts | 🔴 High |
| DELETE | /organizations/:organizationId/rsi-role-mappings | rsiRoleMappingRoutes.ts | 🔴 High |
| GET | /organizations/:orgId/rsi-sync/schedule | rsiSyncScheduleRoutes.ts | 🔴 High |
| POST | /organizations/:orgId/rsi-sync/schedule | rsiSyncScheduleRoutes.ts | 🔴 High |
| POST | /organizations/:orgId/rsi-sync/schedule/enable | rsiSyncScheduleRoutes.ts | 🔴 High |
| POST | /organizations/:orgId/rsi-sync/schedule/disable | rsiSyncScheduleRoutes.ts | 🔴 High |
| DELETE | /organizations/:orgId/rsi-sync/schedule | rsiSyncScheduleRoutes.ts | 🔴 High |
| GET | /organizations/:orgId/rsi-sync/audit | rsiSyncScheduleRoutes.ts | 🔴 High |
| GET | /organizations/:orgId/rsi-sync/audit/stats | rsiSyncScheduleRoutes.ts | 🔴 High |
| GET | /organizations/:orgId/rsi-sync/audit/:logId | rsiSyncScheduleRoutes.ts | 🔴 High |
| POST | /organizations/:orgId/rsi-sync/trigger | rsiSyncScheduleRoutes.ts | 🔴 High |
| GET | /rsi/user/:handle | rsiVerificationRoutes.ts | 🟢 Low |
| GET | /rsi/organization/:sid | rsiVerificationRoutes.ts | 🟢 Low |
| GET | /rsi/verify/status | rsiVerificationRoutes.ts | 🟢 Low |
| POST | /rsi/verify/initiate | rsiVerificationRoutes.ts | 🟢 Low |
| POST | /rsi/verify/complete | rsiVerificationRoutes.ts | 🟢 Low |
| DELETE | /rsi/verify | rsiVerificationRoutes.ts | 🟢 Low |
| POST | /rsi/verify/organization/initiate | rsiVerificationRoutes.ts | 🟢 Low |
| POST | /rsi/verify/organization/complete | rsiVerificationRoutes.ts | 🟢 Low |
| POST | /rsi/verify/organization | rsiVerificationRoutes.ts | 🟢 Low |
| GET | /rotation-check | secretsRoutes.ts | 🟢 Low |
| POST | /rotate-jwt | secretsRoutes.ts | 🟢 Low |
| POST | /rotate-encryption-key | secretsRoutes.ts | 🟢 Low |
| POST | /rotate-db-password | secretsRoutes.ts | 🟢 Low |
| POST | /reload | secretsRoutes.ts | 🟢 Low |
| POST | /shared-accounts | sharedAccountRoutes.ts | 🟢 Low |
| POST | /shared-accounts/bulk-import | sharedAccountRoutes.ts | 🟢 Low |
| POST | /shared-accounts/permissions/grant | sharedAccountRoutes.ts | 🟢 Low |
| GET | /shared-accounts/organization/:organizationId | sharedAccountRoutes.ts | 🟢 Low |
| GET | /shared-accounts/organization/:organizationId/export | sharedAccountRoutes.ts | 🟢 Low |
| GET | /shared-accounts/organization/:organizationId/category/:category | sharedAccountRoutes.ts | 🟢 Low |
| GET | /shared-accounts/organization/:organizationId/tag/:tag | sharedAccountRoutes.ts | 🟢 Low |
| GET | /shared-accounts/organization/:organizationId/expired | sharedAccountRoutes.ts | 🟢 Low |
| GET | /shared-accounts/organization/:organizationId/expiring-soon | sharedAccountRoutes.ts | 🟢 Low |
| GET | /shared-accounts/permissions/user/:userId/organization/:organizationId | sharedAccountRoutes.ts | 🟢 Low |
| GET | /shared-accounts/:id | sharedAccountRoutes.ts | 🟢 Low |
| GET | /shared-accounts/:id/password | sharedAccountRoutes.ts | 🟢 Low |
| GET | /shared-accounts/:id/2fa-secret | sharedAccountRoutes.ts | 🟢 Low |
| GET | /shared-accounts/:id/access-logs | sharedAccountRoutes.ts | 🟢 Low |
| GET | /shared-accounts/:id/analytics | sharedAccountRoutes.ts | 🟢 Low |
| PUT | /shared-accounts/:id | sharedAccountRoutes.ts | 🟢 Low |
| PUT | /shared-accounts/:id/password | sharedAccountRoutes.ts | 🟢 Low |
| PUT | /shared-accounts/:id/2fa-secret | sharedAccountRoutes.ts | 🟢 Low |
| DELETE | /shared-accounts/:id | sharedAccountRoutes.ts | 🟢 Low |
| DELETE | /shared-accounts/permissions/:permissionId | sharedAccountRoutes.ts | 🟢 Low |
| GET | /ships/stats | shipDataRoutes.ts | 🟡 Medium |
| GET | /ships/manufacturers | shipDataRoutes.ts | 🟡 Medium |
| GET | /ships/roles | shipDataRoutes.ts | 🟡 Medium |
| GET | /ships/vehicles | shipDataRoutes.ts | 🟡 Medium |
| GET | /ships/spacecraft | shipDataRoutes.ts | 🟡 Medium |
| POST | /:id/reactivate | shipRoutes.ts | 🟢 Low |
| DELETE | /:id/share/:targetOrgId | shipRoutes.ts | 🟢 Low |
| GET | /squadrons/:squadronId/members | squadronRoutes.ts | 🟢 Low |
| GET | /squadrons/:squadronId/roster | squadronRoutes.ts | 🟢 Low |
| GET | /squadrons/:squadronId/members/:memberId | squadronRoutes.ts | 🟢 Low |
| GET | /squadrons/:squadronId/members/:userId/check | squadronRoutes.ts | 🟢 Low |
| GET | /squadrons/:squadronId/members/:userId | squadronRoutes.ts | 🟢 Low |
| POST | /squadrons/:squadronId/members | squadronRoutes.ts | 🟢 Low |
| POST | /squadrons/:squadronId/members/bulk | squadronRoutes.ts | 🟢 Low |
| PATCH | /squadrons/members/bulk | squadronRoutes.ts | 🟢 Low |
| DELETE | /squadrons/members/bulk | squadronRoutes.ts | 🟢 Low |
| PATCH | /squadrons/members/bulk/status | squadronRoutes.ts | 🟢 Low |
| PATCH | /squadrons/:squadronId/members/:userId/role | squadronRoutes.ts | 🟢 Low |
| DELETE | /squadrons/:squadronId/members/:userId | squadronRoutes.ts | 🟢 Low |
| GET | /squadrons/:squadronId/count | squadronRoutes.ts | 🟢 Low |
| GET | /squadrons/:squadronId/count/active | squadronRoutes.ts | 🟢 Low |
| GET | /squadrons/:squadronId/stats/roles | squadronRoutes.ts | 🟢 Low |
| GET | /squadrons/:squadronId/stats/ships | squadronRoutes.ts | 🟡 Medium |
| GET | /squadrons/:squadronId/stats | squadronRoutes.ts | 🟢 Low |
| PUT | /:id/close | ticketRoutes.ts | 🟢 Low |
| PUT | /:id/reopen | ticketRoutes.ts | 🟢 Low |
| POST | /:id/feedback | ticketRoutes.ts | 🟢 Low |
| POST | /tournaments | tournamentRoutes.ts | 🟢 Low |
| GET | /tournaments | tournamentRoutes.ts | 🟢 Low |
| GET | /tournaments/:id | tournamentRoutes.ts | 🟢 Low |
| POST | /tournaments/:id/register | tournamentRoutes.ts | 🟢 Low |
| POST | /tournaments/:id/start | tournamentRoutes.ts | 🟢 Low |
| PUT | /tournaments/:id/matches/:matchId | tournamentRoutes.ts | 🟢 Low |
| POST | /routes | trading.ts | 🟢 Low |
| GET | /routes | trading.ts | 🟢 Low |
| GET | /routes/:id | trading.ts | 🟢 Low |
| PUT | /routes/:id | trading.ts | 🟢 Low |
| DELETE | /routes/:id | trading.ts | 🟢 Low |
| POST | /routes/:id/runs | trading.ts | 🟢 Low |
| GET | /opportunities | trading.ts | 🟢 Low |
| POST | /routes/optimize | trading.ts | 🟢 Low |
| GET | /routes/:id/analysis | trading.ts | 🟢 Low |
| POST | /routes/refresh | trading.ts | 🟢 Low |
| POST | /trading-routes | tradingRouteRoutes.ts | 🟢 Low |
| GET | /trading-routes | tradingRouteRoutes.ts | 🟢 Low |
| GET | /trading-routes/:id | tradingRouteRoutes.ts | 🟢 Low |
| PUT | /trading-routes/:id/performance | tradingRouteRoutes.ts | 🟢 Low |
| PUT | /trading-routes/:id/status | tradingRouteRoutes.ts | 🟢 Low |
| POST | /:id/connect | tunnelRoutes.ts | 🟢 Low |
| POST | /:id/disconnect | tunnelRoutes.ts | 🟢 Low |
| PUT | /:id/rate-limit | tunnelRoutes.ts | 🟢 Low |
| PUT | /:id/content-filter | tunnelRoutes.ts | 🟢 Low |
| GET | /:id/config | tunnelRoutes.ts | 🟢 Low |
| GET | /stats/system | tunnelRoutes.ts | 🟢 Low |
| GET | /stats/hourly | tunnelRoutes.ts | 🟢 Low |
| POST | /analytics/reset | tunnelRoutes.ts | 🟢 Low |
| GET | /auth/2fa/status | twoFactorRoutes.ts | 🔴 High |
| POST | /auth/2fa/setup | twoFactorRoutes.ts | 🔴 High |
| POST | /auth/2fa/verify-login | twoFactorRoutes.ts | 🔴 High |
| POST | /auth/2fa/backup-codes | twoFactorRoutes.ts | 🔴 High |
| GET | /users/:userId/organizations | userOrganizationRoutes.ts | 🔴 High |
| GET | /organizations/:organizationId/users | userOrganizationRoutes.ts | 🔴 High |
| POST | /users/:userId/organizations | userOrganizationRoutes.ts | 🔴 High |
| DELETE | /users/:userId/organizations/:organizationId | userOrganizationRoutes.ts | 🔴 High |
| PUT | /users/:userId/active-organization | userOrganizationRoutes.ts | 🟢 Low |
| GET | /users/:userId/active-organization | userOrganizationRoutes.ts | 🟢 Low |
| PATCH | /users/me | userRoutes.ts | 🟢 Low |
| POST | /users/me/change-password | userRoutes.ts | 🟢 Low |
| GET | /users/:id/activity | userRoutes.ts | 🟢 Low |
| GET | /users/:id/activity/stats | userRoutes.ts | 🟢 Low |
| GET | /admin/activity/stats | userRoutes.ts | 🟢 Low |
| GET | /users/:id/dashboard | userRoutes.ts | 🟢 Low |
| PUT | /users/:id/profile | userRoutes.ts | 🟢 Low |
| GET | /users/:id/preferences | userRoutes.ts | 🟢 Low |
| PUT | /users/:id/preferences | userRoutes.ts | 🟢 Low |
| GET | /users/:id/social/connections | userRoutes.ts | 🟢 Low |
| POST | /users/:id/social/follow | userRoutes.ts | 🟢 Low |
| GET | /users/:id/social/activity | userRoutes.ts | 🟢 Low |
| GET | /users/:id/export | userRoutes.ts | 🟢 Low |
| GET | /users/:userId/ships | userShipRoutes.ts | 🟡 Medium |
| GET | /users/:userId/ships/summary | userShipRoutes.ts | 🟡 Medium |
| GET | /users/:userId/ships/:shipId | userShipRoutes.ts | 🟡 Medium |
| POST | /users/:userId/ships | userShipRoutes.ts | 🟡 Medium |
| PATCH | /users/:userId/ships/:shipId | userShipRoutes.ts | 🟡 Medium |
| DELETE | /users/:userId/ships/:shipId | userShipRoutes.ts | 🟡 Medium |
| GET | /users/:userId/ships/insurance/expiring | userShipRoutes.ts | 🟡 Medium |
| POST | /users/:userId/ships/:shipId/loan | userShipRoutes.ts | 🟡 Medium |
| POST | /users/:userId/ships/:shipId/return | userShipRoutes.ts | 🟡 Medium |
| GET | /organizations/:orgId/available-user-ships | userShipRoutes.ts | 🔴 High |
| GET | /auth/webauthn/supported | webAuthnRoutes.ts | 🔴 High |
| GET | /auth/webauthn/credentials | webAuthnRoutes.ts | 🔴 High |
| POST | /auth/webauthn/register/start | webAuthnRoutes.ts | 🔴 High |
| POST | /auth/webauthn/register/complete | webAuthnRoutes.ts | 🔴 High |
| PATCH | /auth/webauthn/credentials/:credentialId | webAuthnRoutes.ts | 🔴 High |
| DELETE | /auth/webauthn/credentials/:credentialId | webAuthnRoutes.ts | 🔴 High |
| GET | /webhooks/event-types | webhookRoutes.ts | 🟢 Low |
| GET | /webhooks/statistics | webhookRoutes.ts | 🟢 Low |
| GET | /webhooks/batch/config | webhookRoutes.ts | 🟢 Low |
| PUT | /webhooks/batch/config | webhookRoutes.ts | 🟢 Low |
| POST | /webhooks/batch/queue | webhookRoutes.ts | 🟢 Low |
| GET | /webhooks/batch/pending | webhookRoutes.ts | 🟢 Low |
| POST | /webhooks/batch/flush | webhookRoutes.ts | 🟢 Low |
| DELETE | /webhooks/batch/pending | webhookRoutes.ts | 🟢 Low |
| POST | /webhooks/validate | webhookRoutes.ts | 🟢 Low |
| POST | /webhooks/trigger-event | webhookRoutes.ts | 🟢 Low |
| POST | /webhooks | webhookRoutes.ts | 🟢 Low |
| GET | /webhooks | webhookRoutes.ts | 🟢 Low |
| GET | /webhooks/:id | webhookRoutes.ts | 🟢 Low |
| PATCH | /webhooks/:id | webhookRoutes.ts | 🟢 Low |
| DELETE | /webhooks/:id | webhookRoutes.ts | 🟢 Low |
| POST | /webhooks/:id/test | webhookRoutes.ts | 🟢 Low |
| POST | /webhooks/:id/test-custom | webhookRoutes.ts | 🟢 Low |
| POST | /webhooks/:id/preview | webhookRoutes.ts | 🟢 Low |
| GET | /webhooks/:id/deliveries | webhookRoutes.ts | 🟢 Low |


---

## V2-Only Endpoints (New Features) (664)

| Method | V2 Path | File | Category |
|--------|---------|------|----------|
| POST | /setup | 2fa.ts | ✨ New Feature |
| POST | /verify | 2fa.ts | ✨ New Feature |
| POST | /disable | 2fa.ts | ✨ New Feature |
| POST | /verify-login | 2fa.ts | ✨ New Feature |
| POST | /backup-codes | 2fa.ts | ✨ New Feature |
| POST | /:achievementId/award | achievements.ts | ✨ New Feature |
| GET | /leaderboard | achievements.ts | ✨ New Feature |
| GET | /activities/recommended | activities.ts | ✨ New Feature |
| GET | /activities/upcoming | activities.ts | ✨ New Feature |
| GET | /activities/statistics | activities.ts | ✨ New Feature |
| GET | /users/me/activities | activities.ts | ✨ New Feature |
| GET | /organizations/:orgId/activities | activities.ts | ✨ New Feature |
| POST | /organizations/:orgId/activities | activities.ts | ✨ New Feature |
| GET | /organizations/:orgId/activities/analytics | activities.ts | 📊 Analytics |
| POST | /activities/:id/join | activities.ts | ✨ New Feature |
| POST | /activities/:id/leave | activities.ts | ✨ New Feature |
| GET | /activities/:id/participants | activities.ts | ✨ New Feature |
| PUT | /activities/:id/participants/:userId | activities.ts | ✨ New Feature |
| GET | /organizations/:orgId/activities/calendar | activities.ts | ✨ New Feature |
| GET | /activities/:id/calendar-export | activities.ts | ✨ New Feature |
| POST | /activities/:id/reminders | activities.ts | ✨ New Feature |
| GET | /activities/:id/reminders | activities.ts | ✨ New Feature |
| PUT | /activities/:id/status | activities.ts | ✨ New Feature |
| POST | /activities/:id/complete | activities.ts | ✨ New Feature |
| POST | /activities/:id/invite-org | activities.ts | ✨ New Feature |
| POST | /activities/:id/accept-invite | activities.ts | ✨ New Feature |
| POST | /activities/:id/decline-invite | activities.ts | ✨ New Feature |
| POST | /activities/:id/voice | activities.ts | ✨ New Feature |
| POST | /activities/:id/voice/link | activities.ts | ✨ New Feature |
| POST | /organizations/:orgId/activities/batch | activities.ts | ✨ New Feature |
| POST | /activities/batch/update | activities.ts | ✨ New Feature |
| POST | /activities/batch/delete | activities.ts | ✨ New Feature |
| POST | /activities/:id/ships | activities.ts | ✨ New Feature |
| POST | /activities/:id/ships/:ownerId/crew | activities.ts | ✨ New Feature |
| DELETE | /activities/:id/ships/crew | activities.ts | ✨ New Feature |
| GET | /activities/:id/ships/available-crew | activities.ts | ✨ New Feature |
| POST | /activities/:id/route | activities.ts | ✨ New Feature |
| PUT | /activities/:id/route/:order | activities.ts | ✨ New Feature |
| POST | /activities/:id/enrich-mining | activities.ts | ✨ New Feature |
| PATCH | /feature-flags/:id | admin.ts | ✨ New Feature |
| GET | /:id | allianceDiplomacy.ts | ✨ New Feature |
| POST | /:id/approve | allianceDiplomacy.ts | ✨ New Feature |
| POST | /:id/suspend | allianceDiplomacy.ts | ✨ New Feature |
| POST | /:id/terminate | allianceDiplomacy.ts | ✨ New Feature |
| POST | /:id/incidents | allianceDiplomacy.ts | ✨ New Feature |
| PUT | /:id/incidents/:incidentId/resolve | allianceDiplomacy.ts | ✨ New Feature |
| GET | /user-activity | analytics.ts | ✨ New Feature |
| GET | /fleet-stats | analytics.ts | ✨ New Feature |
| GET | /org-metrics | analytics.ts | ✨ New Feature |
| GET | /engagement | analytics.ts | ✨ New Feature |
| GET | /retention | analytics.ts | ✨ New Feature |
| GET | /revenue | analytics.ts | ✨ New Feature |
| POST | /export | analytics.ts | ✨ New Feature |
| GET | /reports | analytics.ts | ✨ New Feature |
| POST | /reports | analytics.ts | ✨ New Feature |
| GET | /reports/:reportId | analytics.ts | ✨ New Feature |
| GET | /:announcementId | announcements.ts | ✨ New Feature |
| PUT | /:announcementId | announcements.ts | ✨ New Feature |
| DELETE | /:announcementId | announcements.ts | ✨ New Feature |
| POST | /:announcementId/publish | announcements.ts | ✨ New Feature |
| POST | /:announcementId/pin | announcements.ts | ✨ New Feature |
| POST | /:announcementId/read | announcements.ts | ✨ New Feature |
| GET | /:keyId | apiKeys.ts | ✨ New Feature |
| PUT | /:keyId | apiKeys.ts | ✨ New Feature |
| DELETE | /:keyId | apiKeys.ts | ✨ New Feature |
| GET | /:approvalId | approvals.ts | ✨ New Feature |
| POST | /:approvalId/approve | approvals.ts | ✨ New Feature |
| POST | /:approvalId/reject | approvals.ts | ✨ New Feature |
| POST | /:approvalId/delegate | approvals.ts | ✨ New Feature |
| GET | /pending | approvals.ts | ✨ New Feature |
| GET | /:archiveId | archives.ts | ✨ New Feature |
| POST | /:archiveId/restore | archives.ts | ✨ New Feature |
| DELETE | /:archiveId | archives.ts | ✨ New Feature |
| POST | /bulk | archives.ts | ✨ New Feature |
| GET | /logs | audit.ts | ✨ New Feature |
| GET | /logs/:logId | audit.ts | ✨ New Feature |
| GET | /user/:userId | audit.ts | ✨ New Feature |
| GET | /organization/:orgId | audit.ts | ✨ New Feature |
| POST | /retention | audit.ts | ✨ New Feature |
| GET | /auth/discord | auth.ts | ✨ New Feature |
| POST | /auth/sessions/:sessionId/revoke | auth.ts | ✨ New Feature |
| GET | /auth/tokens/verify | auth.ts | ✨ New Feature |
| POST | /auth/2fa/enable | auth.ts | ✨ New Feature |
| GET | /status | backup.ts | ✨ New Feature |
| POST | /create | backup.ts | ✨ New Feature |
| GET | /list | backup.ts | ✨ New Feature |
| POST | /:backupId/restore | backup.ts | ✨ New Feature |
| DELETE | /:backupId | backup.ts | ✨ New Feature |
| POST | /schedule | backup.ts | ✨ New Feature |
| GET | /:id | bounties.ts | ✨ New Feature |
| DELETE | /:id | bounties.ts | ✨ New Feature |
| GET | /:id | briefings.ts | ✨ New Feature |
| GET | /mission/:missionId | briefings.ts | ✨ New Feature |
| PUT | /:id | briefings.ts | ✨ New Feature |
| DELETE | /:id | briefings.ts | ✨ New Feature |
| POST | /:id/elements | briefings.ts | ✨ New Feature |
| PUT | /:id/elements/:elementId | briefings.ts | ✨ New Feature |
| DELETE | /:id/elements/:elementId | briefings.ts | ✨ New Feature |
| POST | /:id/participants | briefings.ts | ✨ New Feature |
| DELETE | /:id/participants | briefings.ts | ✨ New Feature |
| POST | /:id/version | briefings.ts | ✨ New Feature |
| GET | /events | calendar.ts | ✨ New Feature |
| GET | /events/:eventId | calendar.ts | ✨ New Feature |
| PUT | /events/:eventId | calendar.ts | ✨ New Feature |
| DELETE | /events/:eventId | calendar.ts | ✨ New Feature |
| GET | /availability | calendar.ts | ✨ New Feature |
| POST | /sync | calendar.ts | ✨ New Feature |
| GET | / | certifications.ts | ✨ New Feature |
| POST | / | certifications.ts | ✨ New Feature |
| GET | /:certId | certifications.ts | ✨ New Feature |
| PUT | /:certId | certifications.ts | ✨ New Feature |
| DELETE | /:certId | certifications.ts | ✨ New Feature |
| POST | /:certId/award | certifications.ts | ✨ New Feature |
| POST | /:certId/revoke | certifications.ts | ✨ New Feature |
| GET | /user/:userId | certifications.ts | ✨ New Feature |
| GET | /:certId/holders | certifications.ts | ✨ New Feature |
| GET | / | claims.ts | ✨ New Feature |
| POST | / | claims.ts | ✨ New Feature |
| GET | /:claimId | claims.ts | ✨ New Feature |
| PUT | /:claimId | claims.ts | ✨ New Feature |
| DELETE | /:claimId | claims.ts | ✨ New Feature |
| POST | /:claimId/submit-evidence | claims.ts | ✨ New Feature |
| GET | /:claimId/evidence | claims.ts | ✨ New Feature |
| POST | /:claimId/approve | claims.ts | ✨ New Feature |
| POST | /:claimId/reject | claims.ts | ✨ New Feature |
| GET | / | combat.ts | ✨ New Feature |
| POST | / | combat.ts | ✨ New Feature |
| GET | /:combatId | combat.ts | ✨ New Feature |
| PUT | /:combatId | combat.ts | ✨ New Feature |
| DELETE | /:combatId | combat.ts | ✨ New Feature |
| GET | /:combatId/statistics | combat.ts | ✨ New Feature |
| GET | /user/:userId/stats | combat.ts | ✨ New Feature |
| GET | /leaderboard | combat.ts | ✨ New Feature |
| GET | / | comments.ts | ✨ New Feature |
| POST | / | comments.ts | ✨ New Feature |
| GET | /:commentId | comments.ts | ✨ New Feature |
| PUT | /:commentId | comments.ts | ✨ New Feature |
| DELETE | /:commentId | comments.ts | ✨ New Feature |
| POST | /:commentId/reply | comments.ts | ✨ New Feature |
| POST | /:commentId/like | comments.ts | ✨ New Feature |
| DELETE | /:commentId/like | comments.ts | ✨ New Feature |
| GET | /:commentId/replies | comments.ts | ✨ New Feature |
| GET | / | config.ts | ✨ New Feature |
| PUT | / | config.ts | ✨ New Feature |
| GET | /:key | config.ts | ✨ New Feature |
| PUT | /:key | config.ts | ✨ New Feature |
| DELETE | /:key | config.ts | ✨ New Feature |
| POST | /import | config.ts | ✨ New Feature |
| GET | /export | config.ts | ✨ New Feature |
| GET | /schema | config.ts | ✨ New Feature |
| POST | /contact/submit | contactRequests.ts | ✨ New Feature |
| GET | /contact/options | contactRequests.ts | ✨ New Feature |
| GET | /:organizationId | contactRequests.ts | ✨ New Feature |
| GET | /:organizationId/stats | contactRequests.ts | ✨ New Feature |
| GET | /:organizationId/:requestId | contactRequests.ts | ✨ New Feature |
| PUT | /:organizationId/:requestId | contactRequests.ts | ✨ New Feature |
| GET | /requests | contacts.ts | ✨ New Feature |
| POST | /requests | contacts.ts | ✨ New Feature |
| POST | /requests/:requestId/accept | contacts.ts | ✨ New Feature |
| POST | /requests/:requestId/decline | contacts.ts | ✨ New Feature |
| GET | /list | contacts.ts | ✨ New Feature |
| GET | /:contactId | contacts.ts | ✨ New Feature |
| DELETE | /:contactId | contacts.ts | ✨ New Feature |
| PUT | /:contactId/notes | contacts.ts | ✨ New Feature |
| GET | /balance | credits.ts | ✨ New Feature |
| GET | /transactions | credits.ts | ✨ New Feature |
| POST | /transfer | credits.ts | ✨ New Feature |
| GET | /pending | credits.ts | ✨ New Feature |
| POST | /earn | credits.ts | ✨ New Feature |
| POST | /spend | credits.ts | ✨ New Feature |
| GET | /leaderboard | credits.ts | ✨ New Feature |
| POST | / | crewAssignments.ts | ✨ New Feature |
| GET | / | crewAssignments.ts | ✨ New Feature |
| GET | /:id | crewAssignments.ts | ✨ New Feature |
| POST | /:id/crew | crewAssignments.ts | ✨ New Feature |
| DELETE | /:id/crew/:userId | crewAssignments.ts | ✨ New Feature |
| GET | / | dashboards.ts | ✨ New Feature |
| POST | / | dashboards.ts | ✨ New Feature |
| GET | /:dashboardId | dashboards.ts | ✨ New Feature |
| PUT | /:dashboardId | dashboards.ts | ✨ New Feature |
| DELETE | /:dashboardId | dashboards.ts | ✨ New Feature |
| POST | /:dashboardId/widgets | dashboards.ts | ✨ New Feature |
| PUT | /:dashboardId/widgets/:widgetId | dashboards.ts | ✨ New Feature |
| DELETE | /:dashboardId/widgets/:widgetId | dashboards.ts | ✨ New Feature |
| GET | /directory/organizations | directory.ts | ✨ New Feature |
| GET | /directory/organizations/stats | directory.ts | ✨ New Feature |
| GET | /directory/organizations/:organizationId | directory.ts | ✨ New Feature |
| GET | /directory/organizations/:organizationId/seo | directory.ts | ✨ New Feature |
| GET | /guilds/:guildId/roles/:userId | discord.ts | 🔒 Security |
| POST | /guilds/:guildId/roles/:userId | discord.ts | 🔒 Security |
| DELETE | /guilds/:guildId/roles/:userId | discord.ts | 🔒 Security |
| GET | /guilds/:guildId | discord.ts | ✨ New Feature |
| GET | /guilds/:guildId/members | discord.ts | ✨ New Feature |
| GET | / | documents.ts | ✨ New Feature |
| POST | / | documents.ts | ✨ New Feature |
| GET | /:documentId | documents.ts | ✨ New Feature |
| PUT | /:documentId | documents.ts | ✨ New Feature |
| DELETE | /:documentId | documents.ts | ✨ New Feature |
| GET | /:documentId/download | documents.ts | ✨ New Feature |
| POST | /:documentId/share | documents.ts | ✨ New Feature |
| GET | /folders | documents.ts | ✨ New Feature |
| POST | /folders | documents.ts | ✨ New Feature |
| POST | /organizations/:organizationId/encryption/initialize | encryption.ts | 🔐 Encryption |
| GET | /organizations/:organizationId/encryption/status | encryption.ts | 🔐 Encryption |
| GET | /organizations/:organizationId/encryption/key | encryption.ts | 🔐 Encryption |
| POST | /organizations/:organizationId/encryption/share-key | encryption.ts | 🔐 Encryption |
| DELETE | /organizations/:organizationId/encryption/revoke-key/:userId | encryption.ts | 🔐 Encryption |
| POST | /organizations/:organizationId/encrypted-data | encryption.ts | ✨ New Feature |
| GET | /organizations/:organizationId/encrypted-data/:dataId | encryption.ts | ✨ New Feature |
| DELETE | /organizations/:organizationId/encrypted-data/:dataId | encryption.ts | ✨ New Feature |
| GET | /organizations/:organizationId/encryption/audit-log | encryption.ts | 🔐 Encryption |
| POST | /organizations/:organizationId/encryption/rotate-key | encryption.ts | 🔐 Encryption |
| DELETE | /organizations/:organizationId/encryption | encryption.ts | 🔐 Encryption |
| GET | / | equipment.ts | ✨ New Feature |
| POST | / | equipment.ts | ✨ New Feature |
| GET | /:equipmentId | equipment.ts | ✨ New Feature |
| PUT | /:equipmentId | equipment.ts | ✨ New Feature |
| DELETE | /:equipmentId | equipment.ts | ✨ New Feature |
| GET | /:equipmentId/compatibility | equipment.ts | ✨ New Feature |
| GET | /user/:userId | equipment.ts | ✨ New Feature |
| POST | /:equipmentId/transfer | equipment.ts | ✨ New Feature |
| POST | /errors/track | errors.ts | ✨ New Feature |
| POST | /activities/:id/attend | eventAttendance.ts | ✨ New Feature |
| GET | /activities/:id/attendance | eventAttendance.ts | ✨ New Feature |
| PUT | /activities/:id/attendance/:userId | eventAttendance.ts | ✨ New Feature |
| GET | /users/:userId/attendance | eventAttendance.ts | ✨ New Feature |
| POST | /events/conflicts/check | eventConflicts.ts | ✨ New Feature |
| GET | /events/conflicts/me | eventConflicts.ts | ✨ New Feature |
| GET | /events/conflicts/activity/:activityId | eventConflicts.ts | ✨ New Feature |
| GET | /events/conflicts/user/:userId | eventConflicts.ts | ✨ New Feature |
| GET | /events/conflicts/range | eventConflicts.ts | ✨ New Feature |
| POST | / | events.ts | ✨ New Feature |
| GET | / | events.ts | ✨ New Feature |
| GET | /:id | events.ts | ✨ New Feature |
| PUT | /:id | events.ts | ✨ New Feature |
| DELETE | /:id | events.ts | ✨ New Feature |
| POST | /:id/attendees | events.ts | ✨ New Feature |
| DELETE | /:id/attendees | events.ts | ✨ New Feature |
| POST | /:id/attend | events.ts | ✨ New Feature |
| GET | /:id/attendance | events.ts | ✨ New Feature |
| PUT | /:id/attendance/:userId | events.ts | ✨ New Feature |
| GET | /:id/attendance/stats | events.ts | ✨ New Feature |
| GET | /users/:userId/attendance | events.ts | ✨ New Feature |
| POST | /recurring | events.ts | ✨ New Feature |
| GET | /recurring/:seriesId | events.ts | ✨ New Feature |
| GET | /conflicts/check | events.ts | ✨ New Feature |
| GET | /conflicts/me | events.ts | ✨ New Feature |
| GET | /conflicts/activity/:activityId | events.ts | ✨ New Feature |
| GET | /conflicts/user/:userId | events.ts | ✨ New Feature |
| GET | /conflicts/range | events.ts | ✨ New Feature |
| GET | /upcoming | events.ts | ✨ New Feature |
| GET | /recommended | events.ts | ✨ New Feature |
| POST | /activities/:id/waitlist | eventWaitlist.ts | ✨ New Feature |
| DELETE | /activities/:id/waitlist | eventWaitlist.ts | ✨ New Feature |
| GET | /activities/:id/waitlist | eventWaitlist.ts | ✨ New Feature |
| POST | /activities/:id/waitlist/promote | eventWaitlist.ts | ✨ New Feature |
| POST | / | export.ts | ✨ New Feature |
| GET | /:jobId | export.ts | ✨ New Feature |
| GET | /:jobId/download | export.ts | ✨ New Feature |
| GET | /jobs | export.ts | ✨ New Feature |
| DELETE | /:jobId | export.ts | ✨ New Feature |
| GET | /organizations/:orgId/fleets | fleets.ts | ✨ New Feature |
| POST | /organizations/:orgId/fleets | fleets.ts | ✨ New Feature |
| GET | /organizations/:orgId/fleets/statistics | fleets.ts | ✨ New Feature |
| GET | /fleets/:id | fleets.ts | ✨ New Feature |
| PUT | /fleets/:id | fleets.ts | ✨ New Feature |
| DELETE | /fleets/:id | fleets.ts | ✨ New Feature |
| GET | /fleets/:id/ships | fleets.ts | ✨ New Feature |
| GET | /fleets/:id/composition | fleets.ts | ✨ New Feature |
| GET | /fleets/:id/members | fleets.ts | ✨ New Feature |
| POST | /fleets/:id/members | fleets.ts | ✨ New Feature |
| DELETE | /fleets/:id/members/:shipId | fleets.ts | ✨ New Feature |
| GET | /fleets/:id/roles | fleets.ts | 🔒 Security |
| GET | /fleets/:id/analytics/composition | fleets.ts | 📊 Analytics |
| POST | /fleets/analytics/compare | fleets.ts | 📊 Analytics |
| POST | /fleets/:id/members/bulk | fleets.ts | ✨ New Feature |
| PATCH | /fleets/members/bulk | fleets.ts | ✨ New Feature |
| DELETE | /fleets/members/bulk | fleets.ts | ✨ New Feature |
| GET | /fleets/:id/assignments | fleets.ts | ✨ New Feature |
| POST | /fleets/:id/assignments | fleets.ts | ✨ New Feature |
| DELETE | /fleets/:id/assignments/:assignmentId | fleets.ts | ✨ New Feature |
| GET | /fleets/:id/sharing | fleets.ts | ✨ New Feature |
| PATCH | /fleets/:id/sharing | fleets.ts | ✨ New Feature |
| GET | /export | gdpr.ts | ✨ New Feature |
| GET | /dashboard | gdpr.ts | ✨ New Feature |
| POST | /upload | images.ts | ✨ New Feature |
| GET | /download/:fileName | images.ts | ✨ New Feature |
| GET | /url/:fileName | images.ts | ✨ New Feature |
| GET | / | images.ts | ✨ New Feature |
| DELETE | /:fileName | images.ts | ✨ New Feature |
| POST | / | import.ts | ✨ New Feature |
| GET | /:jobId | import.ts | ✨ New Feature |
| GET | /jobs | import.ts | ✨ New Feature |
| POST | /:jobId/cancel | import.ts | ✨ New Feature |
| POST | /validate | import.ts | ✨ New Feature |
| GET | / | integrations.ts | ✨ New Feature |
| POST | / | integrations.ts | ✨ New Feature |
| GET | /:integrationId | integrations.ts | ✨ New Feature |
| PUT | /:integrationId | integrations.ts | ✨ New Feature |
| DELETE | /:integrationId | integrations.ts | ✨ New Feature |
| POST | /:integrationId/test | integrations.ts | ✨ New Feature |
| POST | /:integrationId/sync | integrations.ts | ✨ New Feature |
| GET | /:integrationId/logs | integrations.ts | ✨ New Feature |
| GET | /available | integrations.ts | ✨ New Feature |
| GET | /organizations/:orgId/cargo-manifests | inventory.ts | ✨ New Feature |
| POST | /organizations/:orgId/cargo-manifests | inventory.ts | ✨ New Feature |
| GET | /public | jobs.ts | ✨ New Feature |
| GET | /public/:jobId | jobs.ts | ✨ New Feature |
| POST | / | jobs.ts | ✨ New Feature |
| GET | /:jobId | jobs.ts | ✨ New Feature |
| PUT | /:jobId | jobs.ts | ✨ New Feature |
| DELETE | /:jobId | jobs.ts | ✨ New Feature |
| POST | /:jobId/applications/:appId/approve | jobs.ts | ✨ New Feature |
| POST | /:jobId/applications/:appId/reject | jobs.ts | ✨ New Feature |
| GET | /my-listings/all | jobs.ts | ✨ New Feature |
| GET | /my-applications/list | jobs.ts | ✨ New Feature |
| GET | /fleet/:fleetId | logistics.ts | ✨ New Feature |
| GET | /fleet/:fleetId/supplies | logistics.ts | ✨ New Feature |
| POST | /fleet/:fleetId/supplies/request | logistics.ts | ✨ New Feature |
| GET | /fleet/:fleetId/routes | logistics.ts | ✨ New Feature |
| POST | /fleet/:fleetId/routes | logistics.ts | ✨ New Feature |
| GET | /fleet/:fleetId/inventory | logistics.ts | ✨ New Feature |
| POST | /fleet/:fleetId/transfer | logistics.ts | ✨ New Feature |
| GET | /fleet/:fleetId/costs | logistics.ts | ✨ New Feature |
| GET | /fleet/:fleetId/history | logistics.ts | ✨ New Feature |
| GET | / | messages.ts | ✨ New Feature |
| POST | / | messages.ts | ✨ New Feature |
| GET | /:messageId | messages.ts | ✨ New Feature |
| DELETE | /:messageId | messages.ts | ✨ New Feature |
| POST | /:messageId/read | messages.ts | ✨ New Feature |
| GET | /threads/:threadId | messages.ts | ✨ New Feature |
| POST | /:messageId/reply | messages.ts | ✨ New Feature |
| GET | /unread/count | messages.ts | ✨ New Feature |
| POST | /web-vitals | metrics.ts | ✨ New Feature |
| POST | / | mining.ts | ✨ New Feature |
| GET | / | mining.ts | ✨ New Feature |
| GET | /:id | mining.ts | ✨ New Feature |
| POST | /:id/crew | mining.ts | ✨ New Feature |
| POST | /:id/resources | mining.ts | ✨ New Feature |
| PUT | /:id/status | mining.ts | ✨ New Feature |
| GET | / | missions.ts | ✨ New Feature |
| POST | / | missions.ts | ✨ New Feature |
| GET | /:missionId | missions.ts | ✨ New Feature |
| PUT | /:missionId | missions.ts | ✨ New Feature |
| DELETE | /:missionId | missions.ts | ✨ New Feature |
| POST | /:missionId/assign | missions.ts | ✨ New Feature |
| GET | /:missionId/participants | missions.ts | ✨ New Feature |
| GET | /templates | missions.ts | ✨ New Feature |
| POST | /report | moderation.ts | ✨ New Feature |
| GET | /reports | moderation.ts | ✨ New Feature |
| GET | /reports/:reportId | moderation.ts | ✨ New Feature |
| POST | /reports/:reportId/action | moderation.ts | ✨ New Feature |
| GET | /user/:userId/infractions | moderation.ts | ✨ New Feature |
| POST | /user/:userId/warning | moderation.ts | ✨ New Feature |
| POST | /user/:userId/suspend | moderation.ts | ✨ New Feature |
| POST | /user/:userId/ban | moderation.ts | ✨ New Feature |
| GET | / | notifications.ts | ✨ New Feature |
| POST | /mark-read | notifications.ts | ✨ New Feature |
| POST | /mark-all-read | notifications.ts | ✨ New Feature |
| DELETE | /:notificationId | notifications.ts | ✨ New Feature |
| GET | /preferences/user | notifications.ts | ✨ New Feature |
| PUT | /preferences/user | notifications.ts | ✨ New Feature |
| GET | / | organizations.ts | ✨ New Feature |
| GET | /:id | organizations.ts | ✨ New Feature |
| POST | / | organizations.ts | ✨ New Feature |
| PATCH | /:id | organizations.ts | ✨ New Feature |
| DELETE | /:id | organizations.ts | ✨ New Feature |
| GET | /:id/members | organizations.ts | ✨ New Feature |
| POST | /:id/members | organizations.ts | ✨ New Feature |
| DELETE | /:id/members/:userId | organizations.ts | ✨ New Feature |
| GET | /:orgId/dashboard | organizations.ts | ✨ New Feature |
| GET | /:orgId/overview | organizations.ts | ✨ New Feature |
| GET | /:orgId/feed | organizations.ts | ✨ New Feature |
| GET | /:orgId/activity-trends | organizations.ts | ✨ New Feature |
| GET | /:orgId/insights | organizations.ts | ✨ New Feature |
| GET | /:orgId/members/online | organizations.ts | ✨ New Feature |
| GET | /:orgId/members/ships | organizations.ts | ✨ New Feature |
| PATCH | /:orgId/members/ships/:shipId/classify | organizations.ts | ✨ New Feature |
| PATCH | /:orgId/members/ships/:shipId/declassify | organizations.ts | ✨ New Feature |
| GET | /:orgId/alliances | organizations.ts | ✨ New Feature |
| GET | /:orgId/alliance-statistics | organizations.ts | ✨ New Feature |
| GET | /:orgId/shared-activities | organizations.ts | ✨ New Feature |
| GET | /:orgId/trading/stats | organizations.ts | ✨ New Feature |
| GET | /:orgId/trading/profit-summary | organizations.ts | ✨ New Feature |
| GET | /:orgId/trading/recommendations | organizations.ts | ✨ New Feature |
| GET | /:id/members/:userId | organizations.ts | ✨ New Feature |
| PATCH | /:id/members/:userId/role | organizations.ts | ✨ New Feature |
| PATCH | /:id/members/:userId/title | organizations.ts | ✨ New Feature |
| POST | /:id/members/:userId/transfer | organizations.ts | ✨ New Feature |
| GET | /:id/members/search | organizations.ts | ✨ New Feature |
| GET | /:id/members/stats | organizations.ts | ✨ New Feature |
| GET | /organizations/:id/members/by-role/:role | organizations.ts | ✨ New Feature |
| GET | /organizations/:id/settings | organizations.ts | ✨ New Feature |
| GET | /organizations/:orgId/invitations | organizations.ts | ✨ New Feature |
| POST | /organizations/:orgId/invitations | organizations.ts | ✨ New Feature |
| POST | /organizations/:orgId/invitations/:inviteId/accept | organizations.ts | ✨ New Feature |
| POST | /organizations/:orgId/invitations/:inviteId/decline | organizations.ts | ✨ New Feature |
| GET | /organizations/:orgId/parent | organizations.ts | ✨ New Feature |
| GET | /organizations/:orgId/children | organizations.ts | ✨ New Feature |
| POST | /organizations/:orgId/hierarchy | organizations.ts | ✨ New Feature |
| GET | / | permissions.ts | ✨ New Feature |
| GET | /:id | permissions.ts | ✨ New Feature |
| GET | /security-levels | permissions.ts | ✨ New Feature |
| DELETE | /security-levels | permissions.ts | ✨ New Feature |
| GET | /config | rateLimits.ts | ✨ New Feature |
| PUT | /config | rateLimits.ts | ✨ New Feature |
| GET | /usage | rateLimits.ts | ✨ New Feature |
| POST | /reset | rateLimits.ts | ✨ New Feature |
| GET | / | recruitment.ts | ✨ New Feature |
| POST | / | recruitment.ts | ✨ New Feature |
| GET | /:id | recruitment.ts | ✨ New Feature |
| PUT | /:id | recruitment.ts | ✨ New Feature |
| DELETE | /:id | recruitment.ts | ✨ New Feature |
| PUT | /:id/status | recruitment.ts | ✨ New Feature |
| POST | /:id/apply | recruitment.ts | ✨ New Feature |
| GET | /:id/applications | recruitment.ts | ✨ New Feature |
| POST | /recurring-activities/next-occurrence | recurringActivities.ts | ✨ New Feature |
| POST | /recurring-activities/occurrences | recurringActivities.ts | ✨ New Feature |
| POST | /recurring-activities/parse | recurringActivities.ts | ✨ New Feature |
| POST | /recurring-activities/format | recurringActivities.ts | ✨ New Feature |
| POST | /recurring-activities/create-instances | recurringActivities.ts | ✨ New Feature |
| POST | /recurring-activities/preview | recurringActivities.ts | ✨ New Feature |
| GET | /recurring-activities/frequencies | recurringActivities.ts | ✨ New Feature |
| POST | / | relationships.ts | ✨ New Feature |
| GET | /:id | relationships.ts | ✨ New Feature |
| PUT | /:id | relationships.ts | ✨ New Feature |
| DELETE | /:id | relationships.ts | ✨ New Feature |
| GET | /:id/history | relationships.ts | ✨ New Feature |
| GET | / | reports.ts | ✨ New Feature |
| POST | / | reports.ts | ✨ New Feature |
| GET | /:reportId | reports.ts | ✨ New Feature |
| PUT | /:reportId | reports.ts | ✨ New Feature |
| DELETE | /:reportId | reports.ts | ✨ New Feature |
| POST | /:reportId/generate | reports.ts | ✨ New Feature |
| GET | /:reportId/download | reports.ts | ✨ New Feature |
| POST | /:reportId/schedule | reports.ts | ✨ New Feature |
| GET | /templates | reports.ts | ✨ New Feature |
| GET | /:userId | reputation.ts | ✨ New Feature |
| PUT | /:userId | reputation.ts | ✨ New Feature |
| GET | /top | reputation.ts | ✨ New Feature |
| GET | / | roles.ts | ✨ New Feature |
| POST | / | roles.ts | ✨ New Feature |
| GET | /:roleId | roles.ts | ✨ New Feature |
| PUT | /:roleId | roles.ts | ✨ New Feature |
| DELETE | /:roleId | roles.ts | ✨ New Feature |
| POST | /:roleId/assign | roles.ts | ✨ New Feature |
| DELETE | /:roleId/assign/:userId | roles.ts | ✨ New Feature |
| GET | /:roleId/permissions | roles.ts | 🔒 Security |
| POST | /:roleId/permissions | roles.ts | 🔒 Security |
| DELETE | /:roleId/permissions/:permissionId | roles.ts | 🔒 Security |
| GET | /search/by-scope | roles.ts | ✨ New Feature |
| GET | /templates | roles.ts | ✨ New Feature |
| POST | /templates/:templateId/apply | roles.ts | ✨ New Feature |
| POST | /verify | rsi.ts | ✨ New Feature |
| GET | /verify/:verificationId | rsi.ts | ✨ New Feature |
| POST | /verify/:verificationId/confirm | rsi.ts | ✨ New Feature |
| GET | /profile/:rsiHandle | rsi.ts | ✨ New Feature |
| GET | /orgs/:rsiHandle | rsi.ts | ✨ New Feature |
| POST | /sync | rsi.ts | ✨ New Feature |
| GET | /sync/status | rsi.ts | ✨ New Feature |
| GET | /templates | rsiRoleMapping.ts | ✨ New Feature |
| GET | /templates/:templateName | rsiRoleMapping.ts | ✨ New Feature |
| GET | /:organizationId | rsiRoleMapping.ts | ✨ New Feature |
| GET | /:organizationId/summary | rsiRoleMapping.ts | ✨ New Feature |
| GET | /:organizationId/:id | rsiRoleMapping.ts | ✨ New Feature |
| POST | /:organizationId | rsiRoleMapping.ts | ✨ New Feature |
| PUT | /:organizationId/:id | rsiRoleMapping.ts | ✨ New Feature |
| DELETE | /:organizationId/:id | rsiRoleMapping.ts | ✨ New Feature |
| GET | /schedule/:orgId | rsiSync.ts | ✨ New Feature |
| POST | /schedule/:orgId | rsiSync.ts | ✨ New Feature |
| POST | /schedule/:orgId/enable | rsiSync.ts | ✨ New Feature |
| POST | /schedule/:orgId/disable | rsiSync.ts | ✨ New Feature |
| GET | /audit/:orgId | rsiSync.ts | 📝 Audit |
| GET | /global | search.ts | ✨ New Feature |
| GET | /fleets | search.ts | ✨ New Feature |
| GET | /activities | search.ts | ✨ New Feature |
| GET | /suggestions | search.ts | ✨ New Feature |
| GET | /trending | search.ts | ✨ New Feature |
| GET | / | sharedAccounts.ts | ✨ New Feature |
| POST | / | sharedAccounts.ts | ✨ New Feature |
| GET | /:accountId | sharedAccounts.ts | ✨ New Feature |
| PUT | /:accountId | sharedAccounts.ts | ✨ New Feature |
| DELETE | /:accountId | sharedAccounts.ts | ✨ New Feature |
| GET | /:accountId/members | sharedAccounts.ts | ✨ New Feature |
| POST | /:accountId/members | sharedAccounts.ts | ✨ New Feature |
| DELETE | /:accountId/members/:userId | sharedAccounts.ts | ✨ New Feature |
| PUT | /:accountId/members/:userId/role | sharedAccounts.ts | ✨ New Feature |
| GET | /:accountId/audit-log | sharedAccounts.ts | 📝 Audit |
| GET | /ships/catalogue/manufacturers | ships.ts | ✨ New Feature |
| GET | /ships/catalogue/roles | ships.ts | 🔒 Security |
| GET | /ships/catalogue/vehicles | ships.ts | ✨ New Feature |
| GET | /ships/catalogue/spacecraft | ships.ts | ✨ New Feature |
| GET | /ships/catalogue | ships.ts | ✨ New Feature |
| GET | /ships/statistics | ships.ts | ✨ New Feature |
| GET | /ships/search | ships.ts | ✨ New Feature |
| POST | /ships/:id/reactivate | ships.ts | ✨ New Feature |
| POST | /ships/:id/share | ships.ts | ✨ New Feature |
| DELETE | /ships/:id/share/:targetOrgId | ships.ts | ✨ New Feature |
| GET | / | skills.ts | ✨ New Feature |
| POST | / | skills.ts | ✨ New Feature |
| GET | /:skillId | skills.ts | ✨ New Feature |
| PUT | /:skillId | skills.ts | ✨ New Feature |
| DELETE | /:skillId | skills.ts | ✨ New Feature |
| GET | /user/:userId | skills.ts | ✨ New Feature |
| POST | /:skillId/endorse | skills.ts | ✨ New Feature |
| GET | /categories | skills.ts | ✨ New Feature |
| GET | /friends | social.ts | ✨ New Feature |
| POST | /friends/:userId | social.ts | ✨ New Feature |
| DELETE | /friends/:userId | social.ts | ✨ New Feature |
| POST | /friends/:userId/accept | social.ts | ✨ New Feature |
| POST | /block/:userId | social.ts | ✨ New Feature |
| DELETE | /block/:userId | social.ts | ✨ New Feature |
| GET | /feed | social.ts | ✨ New Feature |
| POST | /posts | social.ts | ✨ New Feature |
| POST | /posts/:postId/like | social.ts | ✨ New Feature |
| GET | /presence | social.ts | ✨ New Feature |
| GET | /:squadronId/members | squadrons.ts | ✨ New Feature |
| GET | /:squadronId/roster | squadrons.ts | ✨ New Feature |
| GET | /:squadronId/members/:memberId | squadrons.ts | ✨ New Feature |
| GET | /:squadronId/members/:userId/check | squadrons.ts | ✨ New Feature |
| GET | /:squadronId/members/:userId | squadrons.ts | ✨ New Feature |
| POST | /:squadronId/members | squadrons.ts | ✨ New Feature |
| POST | /:squadronId/members/bulk | squadrons.ts | ✨ New Feature |
| PATCH | /:squadronId/members/:userId/role | squadrons.ts | ✨ New Feature |
| DELETE | /:squadronId/members/:userId | squadrons.ts | ✨ New Feature |
| PATCH | /members/bulk | squadrons.ts | ✨ New Feature |
| DELETE | /members/bulk | squadrons.ts | ✨ New Feature |
| PATCH | /members/bulk/status | squadrons.ts | ✨ New Feature |
| GET | /:squadronId/count | squadrons.ts | ✨ New Feature |
| GET | /:squadronId/count/active | squadrons.ts | ✨ New Feature |
| GET | /:squadronId/stats/roles | squadrons.ts | 🔒 Security |
| GET | /:squadronId/stats/ships | squadrons.ts | ✨ New Feature |
| GET | /:squadronId/stats | squadrons.ts | ✨ New Feature |
| GET | / | subscriptions.ts | ✨ New Feature |
| POST | / | subscriptions.ts | ✨ New Feature |
| GET | /:subscriptionId | subscriptions.ts | ✨ New Feature |
| PUT | /:subscriptionId | subscriptions.ts | ✨ New Feature |
| POST | /:subscriptionId/cancel | subscriptions.ts | ✨ New Feature |
| GET | /plans/available | subscriptions.ts | ✨ New Feature |
| GET | /:subscriptionId/billing-history | subscriptions.ts | ✨ New Feature |
| GET | /status | system.ts | ✨ New Feature |
| GET | /health | system.ts | ✨ New Feature |
| GET | /dependencies | system.ts | ✨ New Feature |
| GET | /uptime | system.ts | ✨ New Feature |
| GET | /version | system.ts | ✨ New Feature |
| GET | /maintenance | system.ts | ✨ New Feature |
| POST | /maintenance | system.ts | ✨ New Feature |
| GET | / | tags.ts | ✨ New Feature |
| POST | / | tags.ts | ✨ New Feature |
| GET | /:tagId | tags.ts | ✨ New Feature |
| PUT | /:tagId | tags.ts | ✨ New Feature |
| DELETE | /:tagId | tags.ts | ✨ New Feature |
| POST | /:tagId/apply | tags.ts | ✨ New Feature |
| DELETE | /:tagId/remove | tags.ts | ✨ New Feature |
| GET | /popular | tags.ts | ✨ New Feature |
| GET | / | templates.ts | ✨ New Feature |
| POST | / | templates.ts | ✨ New Feature |
| GET | /:templateId | templates.ts | ✨ New Feature |
| PUT | /:templateId | templates.ts | ✨ New Feature |
| DELETE | /:templateId | templates.ts | ✨ New Feature |
| POST | /:templateId/clone | templates.ts | ✨ New Feature |
| POST | /:templateId/apply | templates.ts | ✨ New Feature |
| GET | /categories | templates.ts | ✨ New Feature |
| GET | / | tickets.ts | ✨ New Feature |
| POST | / | tickets.ts | ✨ New Feature |
| GET | /:id | tickets.ts | ✨ New Feature |
| PUT | /:id | tickets.ts | ✨ New Feature |
| DELETE | /:id | tickets.ts | ✨ New Feature |
| POST | / | tournaments.ts | ✨ New Feature |
| GET | / | tournaments.ts | ✨ New Feature |
| GET | /:id | tournaments.ts | ✨ New Feature |
| POST | /:id/register | tournaments.ts | ✨ New Feature |
| POST | /:id/start | tournaments.ts | ✨ New Feature |
| PUT | /:id/matches/:matchId | tournaments.ts | ✨ New Feature |
| GET | /organizations/:orgId/trading/routes | trading.ts | ✨ New Feature |
| POST | /organizations/:orgId/trading/routes | trading.ts | ✨ New Feature |
| GET | /organizations/:orgId/trading/analytics | trading.ts | 📊 Analytics |
| GET | /trading/commodities/:commodity/prices | trading.ts | ✨ New Feature |
| GET | /trading/market/trends | trading.ts | ✨ New Feature |
| POST | /trading/prices | trading.ts | ✨ New Feature |
| GET | /trading/market-analysis | trading.ts | ✨ New Feature |
| GET | /trading/routes/:id | trading.ts | ✨ New Feature |
| PUT | /trading/routes/:id | trading.ts | ✨ New Feature |
| DELETE | /trading/routes/:id | trading.ts | ✨ New Feature |
| GET | /trading/routes/:id/profitability | trading.ts | ✨ New Feature |
| POST | /trading/routes/:id/runs | trading.ts | ✨ New Feature |
| GET | /trading/opportunities | trading.ts | ✨ New Feature |
| POST | /trading/routes/refresh | trading.ts | ✨ New Feature |
| GET | / | tunnels.ts | ✨ New Feature |
| POST | / | tunnels.ts | ✨ New Feature |
| GET | /:tunnelId | tunnels.ts | ✨ New Feature |
| PUT | /:tunnelId | tunnels.ts | ✨ New Feature |
| DELETE | /:tunnelId | tunnels.ts | ✨ New Feature |
| POST | /:tunnelId/activate | tunnels.ts | ✨ New Feature |
| POST | /:tunnelId/deactivate | tunnels.ts | ✨ New Feature |
| GET | /:tunnelId/status | tunnels.ts | ✨ New Feature |
| GET | /:tunnelId/traffic | tunnels.ts | ✨ New Feature |
| PUT | /users/me | users.ts | ✨ New Feature |
| GET | /users/me/preferences | users.ts | ✨ New Feature |
| PUT | /users/me/preferences | users.ts | ✨ New Feature |
| GET | /users/me/organizations | users.ts | ✨ New Feature |
| GET | /users/me/ships | users.ts | ✨ New Feature |
| POST | /users/me/password | users.ts | ✨ New Feature |
| GET | /users/me/statistics | users.ts | ✨ New Feature |
| POST | /users/:id/deactivate | users.ts | ✨ New Feature |
| GET | /users/me/notifications | users.ts | ✨ New Feature |
| PATCH | /users/me/notifications/:id | users.ts | ✨ New Feature |
| POST | /users/me/notifications/read-all | users.ts | ✨ New Feature |
| DELETE | /users/me/notifications/:id | users.ts | ✨ New Feature |
| GET | /users/me/notification-settings | users.ts | ✨ New Feature |
| PATCH | /users/me/avatar | users.ts | ✨ New Feature |
| GET | /users/:id/public-profile | users.ts | ✨ New Feature |
| GET | /users/me/linked-accounts | users.ts | ✨ New Feature |
| GET | /users/me/invitations | users.ts | ✨ New Feature |
| GET | /users/me/sessions | users.ts | ✨ New Feature |
| DELETE | /users/me/sessions/:sessionId | users.ts | ✨ New Feature |
| GET | /users/me/privacy-settings | users.ts | ✨ New Feature |
| PATCH | /users/me/privacy-settings | users.ts | ✨ New Feature |
| GET | /users/me/export-data | users.ts | ✨ New Feature |
| POST | /users/me/delete-account | users.ts | ✨ New Feature |
| GET | /users/me/badges | users.ts | ✨ New Feature |
| GET | /users/:userId/permissions | users.ts | 🔒 Security |
| GET | /users | users.ts | ✨ New Feature |
| GET | /polls | voting.ts | ✨ New Feature |
| POST | /polls | voting.ts | ✨ New Feature |
| GET | /polls/:pollId | voting.ts | ✨ New Feature |
| PUT | /polls/:pollId | voting.ts | ✨ New Feature |
| DELETE | /polls/:pollId | voting.ts | ✨ New Feature |
| POST | /polls/:pollId/vote | voting.ts | ✨ New Feature |
| GET | /polls/:pollId/results | voting.ts | ✨ New Feature |
| POST | /polls/:pollId/close | voting.ts | ✨ New Feature |
| GET | /supported | webauthn.ts | ✨ New Feature |
| GET | /credentials | webauthn.ts | ✨ New Feature |
| POST | /register/start | webauthn.ts | ✨ New Feature |
| POST | /register/complete | webauthn.ts | ✨ New Feature |
| PATCH | /credentials/:credentialId | webauthn.ts | ✨ New Feature |
| DELETE | /credentials/:credentialId | webauthn.ts | ✨ New Feature |
| GET | /event-types | webhooks.ts | ✨ New Feature |
| GET | /statistics | webhooks.ts | ✨ New Feature |
| GET | /batch/config | webhooks.ts | ✨ New Feature |
| POST | /test/:id | webhooks.ts | ✨ New Feature |
| GET | / | webhooksV2.ts | ✨ New Feature |
| POST | / | webhooksV2.ts | ✨ New Feature |
| GET | /:webhookId | webhooksV2.ts | ✨ New Feature |
| PUT | /:webhookId | webhooksV2.ts | ✨ New Feature |
| DELETE | /:webhookId | webhooksV2.ts | ✨ New Feature |
| POST | /:webhookId/test | webhooksV2.ts | ✨ New Feature |
| GET | /:webhookId/deliveries | webhooksV2.ts | ✨ New Feature |
| GET | /pages | wiki.ts | ✨ New Feature |
| POST | /pages | wiki.ts | ✨ New Feature |
| GET | /pages/:pageId | wiki.ts | ✨ New Feature |
| PUT | /pages/:pageId | wiki.ts | ✨ New Feature |
| DELETE | /pages/:pageId | wiki.ts | ✨ New Feature |
| GET | /pages/:pageId/history | wiki.ts | ✨ New Feature |
| POST | /pages/:pageId/restore | wiki.ts | ✨ New Feature |
| GET | / | workflows.ts | ✨ New Feature |
| POST | / | workflows.ts | ✨ New Feature |
| GET | /:workflowId | workflows.ts | ✨ New Feature |
| PUT | /:workflowId | workflows.ts | ✨ New Feature |
| DELETE | /:workflowId | workflows.ts | ✨ New Feature |
| POST | /:workflowId/execute | workflows.ts | ✨ New Feature |
| GET | /:workflowId/executions | workflows.ts | ✨ New Feature |
| POST | /:workflowId/enable | workflows.ts | ✨ New Feature |
| POST | /:workflowId/disable | workflows.ts | ✨ New Feature |

---

## Successfully Migrated Endpoints (244)

<details>
<summary>Click to expand</summary>

| Method | V1 Path | V2 Path | File |
|--------|---------|---------|------|
| POST | / | / | achievements.ts |
| GET | /:id | /:achievementId | achievements.ts |
| PUT | /:id | /:achievementId | achievements.ts |
| DELETE | /:id | /:achievementId | achievements.ts |
| GET | / | / | achievements.ts |
| PUT | /:id/status | /:id/status | briefings.ts |
| POST | /:id/complete | /:missionId/complete | missions.ts |
| GET | /dashboard | /dashboard | admin.ts |
| GET | /metrics/system | /metrics/system | admin.ts |
| GET | /metrics/user-actions | /metrics/user-actions | admin.ts |
| GET | /metrics/timeseries | /metrics/timeseries | admin.ts |
| GET | /security/logs | /security/logs | admin.ts |
| GET | /security/summary | /security/summary | admin.ts |
| POST | /security/search | /security/search | admin.ts |
| GET | /feature-flags | /feature-flags | admin.ts |
| GET | /feature-flags/:id | /feature-flags/:id | admin.ts |
| POST | /feature-flags | /feature-flags | admin.ts |
| DELETE | /feature-flags/:id | /feature-flags/:id | admin.ts |
| POST | /users/search | /users/search | admin.ts |
| POST | /users/:userId/actions | /users/:userId/actions | admin.ts |
| GET | /ship-data-fetcher/status | /ship-data-fetcher/status | admin.ts |
| POST | /ship-data-fetcher/refresh | /ship-data-fetcher/refresh | admin.ts |
| GET | /organizations/deletion-requests/pending | /organizations/deletion-requests/pending | admin.ts |
| GET | /organizations/deletion-requests/:requestId | /organizations/deletion-requests/:requestId | admin.ts |
| POST | /organizations/deletion-requests/:requestId/approve | /organizations/deletion-requests/:requestId/approve | admin.ts |
| POST | /organizations/deletion-requests/:requestId/reject | /organizations/deletion-requests/:requestId/reject | admin.ts |
| GET | /activities/:activityId/attendance/stats | /activities/:id/attendance/stats | eventAttendance.ts |
| POST | /auth/login | /auth/login | auth.ts |
| POST | /auth/demo | /auth/demo | auth.ts |
| GET | /auth/discord/callback | /auth/discord/callback | auth.ts |
| POST | /auth/discord/callback | /auth/discord/callback | auth.ts |
| POST | /auth/azuread/callback | /auth/azuread/callback | auth.ts |
| POST | /auth/refresh | /auth/refresh | auth.ts |
| POST | /auth/logout | /auth/logout | auth.ts |
| POST | /auth/logout-all | /auth/logout-all | auth.ts |
| GET | /auth/sessions | /auth/sessions | auth.ts |
| GET | /public | /public | bounties.ts |
| GET | /public/:id | /public/:id | bounties.ts |
| GET | /claims/pending | /claims/pending | bounties.ts |
| GET | /claims/my-claims | /claims/my-claims | bounties.ts |
| GET | / | / | achievements.ts |
| GET | /:id | /:achievementId | achievements.ts |
| POST | /:id/claim | /:id/claim | bounties.ts |
| POST | / | / | achievements.ts |
| PATCH | /:id | /:id | bounties.ts |
| DELETE | /:id | /:achievementId | achievements.ts |
| GET | /:id/claims | /:id/claims | bounties.ts |
| PATCH | /:bountyId/claims/:claimId | /:bountyId/claims/:claimId | bounties.ts |
| DELETE | /:bountyId/claims/:claimId | /:bountyId/claims/:claimId | bounties.ts |
| POST | /:bountyId/claims/:claimId/submit | /:bountyId/claims/:claimId/submit | bounties.ts |
| POST | /:bountyId/claims/:claimId/evidence | /:bountyId/claims/:claimId/evidence | bounties.ts |
| GET | /:bountyId/claims/:claimId/evidence | /:bountyId/claims/:claimId/evidence | bounties.ts |
| DELETE | /:bountyId/claims/:claimId/evidence/:evidenceId | /:bountyId/claims/:claimId/evidence/:evidenceId | bounties.ts |
| GET | /cargo-manifests/:id | /cargo-manifests/:id | inventory.ts |
| POST | /cargo-manifests/:id/cargo | /cargo-manifests/:id/cargo | inventory.ts |
| PUT | /cargo-manifests/:id/status | /cargo-manifests/:id/status | inventory.ts |
| PUT | /cargo-manifests/:id/sharing | /cargo-manifests/:id/sharing | inventory.ts |
| POST | /check | /check | permissions.ts |
| GET | /user/:userId | /user/:userId | achievements.ts |
| GET | /events | /activities | activities.ts |
| GET | /events/:id | /activities/:id | activities.ts |
| POST | /events | /events | calendar.ts |
| PUT | /events/:id | /activities/:id | activities.ts |
| DELETE | /events/:id | /activities/:id | activities.ts |
| GET | /evaluate/:flagId | /evaluate/:flagId | featureFlags.ts |
| POST | /evaluate-batch | /evaluate-batch | featureFlags.ts |
| GET | /enabled | /enabled | featureFlags.ts |
| GET | /:id/analytics | /:id/analytics | featureFlags.ts |
| GET | / | / | achievements.ts |
| GET | /statistics | /statistics | archives.ts |
| GET | /search | /search | archives.ts |
| GET | /:id | /:achievementId | achievements.ts |
| POST | / | / | achievements.ts |
| PUT | /:id | /:achievementId | achievements.ts |
| DELETE | /:id | /:achievementId | achievements.ts |
| POST | /:id/share | /:dashboardId/share | dashboards.ts |
| POST | /consent | /consent | gdpr.ts |
| GET | /consent | /consent | gdpr.ts |
| GET | /consent/:consentType | /consent/:consentType | gdpr.ts |
| GET | /export | /export | audit.ts |
| POST | /export-request | /export-request | gdpr.ts |
| GET | /export-requests | /export-requests | gdpr.ts |
| GET | /export-request/:requestId | /export-request/:requestId | gdpr.ts |
| GET | /export-request/:requestId/download | /export-request/:requestId/download | gdpr.ts |
| DELETE | /delete-account | /delete-account | gdpr.ts |
| POST | /cancel-deletion | /cancel-deletion | gdpr.ts |
| GET | /deletion-status | /deletion-status | gdpr.ts |
| POST | /verify-deletion-email | /verify-deletion-email | gdpr.ts |
| POST | /resend-deletion-confirmation | /resend-deletion-confirmation | gdpr.ts |
| GET | /statistics | /statistics | archives.ts |
| GET | /dashboard | /dashboard | admin.ts |
| GET | /enums | /enums | matchmaking.ts |
| GET | /preferences | /preferences | matchmaking.ts |
| POST | /preferences | /preferences | matchmaking.ts |
| GET | /find | /find | matchmaking.ts |
| POST | /track | /track | matchmaking.ts |
| GET | /analytics | /analytics | matchmaking.ts |
| GET | /organizations/:orgId/inventory/statistics | /organizations/:orgId/inventory/statistics | inventory.ts |
| GET | /organizations/:orgId/inventory | /organizations/:orgId/inventory | inventory.ts |
| POST | /organizations/:orgId/inventory | /organizations/:orgId/inventory | inventory.ts |
| GET | /organizations/:orgId/inventory/:id | /organizations/:orgId/inventory/:id | inventory.ts |
| PATCH | /organizations/:orgId/inventory/:id | /organizations/:orgId/inventory/:id | inventory.ts |
| DELETE | /organizations/:orgId/inventory/:id | /organizations/:orgId/inventory/:id | inventory.ts |
| GET | /organizations | /organizations | search.ts |
| POST | /organizations/:id/permissions | /organizations/:id/permissions | organizations.ts |
| DELETE | /organizations/:id/permissions/:permissionId | /organizations/:id/permissions/:permissionId | organizations.ts |
| GET | /organizations/:id/permissions | /organizations/:id/permissions | organizations.ts |
| POST | /organizations/:id/permissions/check | /organizations/:id/permissions/check | organizations.ts |
| PATCH | /organizations/:id/settings | /organizations/:id/settings | organizations.ts |
| GET | / | / | achievements.ts |
| GET | /organizations/:organizationId/users/:userId/permissions | /organizations/:organizationId/users/:userId/permissions | permissions.ts |
| POST | /organizations/:organizationId/users/:userId/permissions | /organizations/:organizationId/users/:userId/permissions | permissions.ts |
| DELETE | /organizations/:organizationId/users/:userId/permissions | /organizations/:organizationId/users/:userId/permissions | permissions.ts |
| PUT | /organizations/:organizationId/users/:userId/security-level | /organizations/:organizationId/users/:userId/security-level | permissions.ts |
| POST | /security-levels | /security-levels | permissions.ts |
| GET | /organizations/:organizationId/security-levels | /organizations/:organizationId/security-levels | permissions.ts |
| GET | /directory/federations | /directory/federations | directory.ts |
| GET | /directory/federations/stats | /directory/federations/stats | directory.ts |
| GET | /directory/federations/:federationId/seo | /directory/federations/:federationId/seo | directory.ts |
| GET | /directory/federations/:federationId | /directory/federations/:federationId | directory.ts |
| GET | /directory/seo | /directory/seo | directory.ts |
| GET | /directory/jobs | /directory/jobs | publicJobListing.ts |
| GET | /directory/jobs/stats | /directory/jobs/stats | publicJobListing.ts |
| GET | /directory/jobs/options | /directory/jobs/options | publicJobListing.ts |
| GET | /directory/jobs/:jobId | /directory/jobs/:jobId | publicJobListing.ts |
| GET | /directory/:organizationId/jobs/count | /directory/:organizationId/jobs/count | publicJobListing.ts |
| GET | /directory/federations/:federationId/jobs/count | /directory/federations/:federationId/jobs/count | publicJobListing.ts |
| GET | /my-applications | /my-applications | recruitment.ts |
| POST | /:id/discord-apply | /:id/discord-apply | recruitment.ts |
| POST | /:id/invite-binding | /:id/invite-binding | recruitment.ts |
| GET | / | / | achievements.ts |
| POST | / | / | achievements.ts |
| GET | /:id | /:achievementId | achievements.ts |
| PUT | /:id | /:achievementId | achievements.ts |
| DELETE | /:id | /:achievementId | achievements.ts |
| PUT | /:id/status | /:id/status | briefings.ts |
| POST | /:id/apply | /:jobId/apply | jobs.ts |
| GET | /:id/applications | /:jobId/applications | jobs.ts |
| PUT | /:id/applications/:applicationId | /:id/applications/:applicationId | recruitment.ts |
| GET | /types | /types | relationships.ts |
| GET | /change-types | /change-types | relationships.ts |
| GET | /sentiments | /sentiments | relationships.ts |
| POST | / | / | achievements.ts |
| GET | /:id | /:achievementId | achievements.ts |
| PUT | /:id | /:achievementId | achievements.ts |
| DELETE | /:id | /:achievementId | achievements.ts |
| GET | /:id/history | /:approvalId/history | approvals.ts |
| GET | /:id/timeline | /:id/timeline | relationships.ts |
| GET | /:id/analytics | /:id/analytics | featureFlags.ts |
| GET | /:id/sentiment-trend | /:id/sentiment-trend | relationships.ts |
| POST | /:id/interactions | /:id/interactions | relationships.ts |
| POST | /:id/trust | /:id/trust | relationships.ts |
| GET | /:id/trust/history | /:id/trust/history | relationships.ts |
| GET | /:id/trust/recommendations | /:id/trust/recommendations | relationships.ts |
| POST | /:id/mutual | /:id/mutual | relationships.ts |
| GET | /organizations/:orgId/relationships | /organizations/:orgId/relationships | relationships.ts |
| GET | /organizations/:orgId/relationships/health | /organizations/:orgId/relationships/health | relationships.ts |
| GET | /organizations/:orgId/relationships/review | /organizations/:orgId/relationships/review | relationships.ts |
| GET | /status | /status | 2fa.ts |
| GET | /ships/:id | /ships/:id | ships.ts |
| GET | /ships | /ships | ships.ts |
| POST | /ships | /ships | ships.ts |
| PUT | /ships/:id | /ships/:id | ships.ts |
| DELETE | /ships/:id | /ships/:id | ships.ts |
| POST | /loadouts | /loadouts | loadouts.ts |
| GET | /loadouts/popular | /loadouts/popular | loadouts.ts |
| GET | /loadouts/ship/:shipName | /loadouts/ship/:shipName | loadouts.ts |
| GET | /loadouts/:id | /loadouts/:id | loadouts.ts |
| GET | /loadouts/owner/:ownerId | /loadouts/owner/:ownerId | loadouts.ts |
| GET | /loadouts/shared/:userId | /loadouts/shared/:userId | loadouts.ts |
| PUT | /loadouts/:id | /loadouts/:id | loadouts.ts |
| DELETE | /loadouts/:id | /loadouts/:id | loadouts.ts |
| POST | /loadouts/:id/version | /loadouts/:id/version | loadouts.ts |
| GET | /loadouts/:id/history | /loadouts/:id/history | loadouts.ts |
| GET | /loadouts/compare/:id1/:id2 | /loadouts/compare/:id1/:id2 | loadouts.ts |
| POST | /loadouts/:id/share | /loadouts/:id/share | loadouts.ts |
| PUT | /loadouts/:id/sharing | /loadouts/:id/sharing | loadouts.ts |
| POST | /loadouts/:id/share-orgs | /loadouts/:id/share-orgs | loadouts.ts |
| DELETE | /loadouts/:id/share-orgs | /loadouts/:id/share-orgs | loadouts.ts |
| GET | /users/:userId/loadouts | /users/:userId/loadouts | loadouts.ts |
| GET | /loadouts/:id/erkul-url | /loadouts/:id/erkul-url | loadouts.ts |
| PUT | /loadouts/:id/erkul-url | /loadouts/:id/erkul-url | loadouts.ts |
| POST | /ship-loans | /ship-loans | shipLoans.ts |
| GET | /ship-loans | /ship-loans | shipLoans.ts |
| GET | /ship-loans/:id | /ship-loans/:id | shipLoans.ts |
| POST | /ship-loans/:id/approve | /ship-loans/:id/approve | shipLoans.ts |
| POST | /ship-loans/:id/activate | /ship-loans/:id/activate | shipLoans.ts |
| POST | /ship-loans/:id/return | /ship-loans/:id/return | shipLoans.ts |
| POST | /ship-loans/:id/decline | /ship-loans/:id/decline | shipLoans.ts |
| POST | /ship-maintenance | /ship-maintenance | shipMaintenance.ts |
| GET | /ship-maintenance | /ship-maintenance | shipMaintenance.ts |
| GET | /ship-maintenance/:id | /ship-maintenance/:id | shipMaintenance.ts |
| PUT | /ship-maintenance/:id/status | /ship-maintenance/:id/status | shipMaintenance.ts |
| GET | /ship-maintenance/upcoming | /ship-maintenance/upcoming | shipMaintenance.ts |
| GET | /ship-maintenance/overdue | /ship-maintenance/overdue | shipMaintenance.ts |
| GET | / | / | achievements.ts |
| GET | /statistics | /statistics | archives.ts |
| GET | /search | /search | archives.ts |
| GET | /:id | /:achievementId | achievements.ts |
| POST | / | / | achievements.ts |
| PUT | /:id | /:achievementId | achievements.ts |
| DELETE | /:id | /:achievementId | achievements.ts |
| POST | /:id/share | /:dashboardId/share | dashboards.ts |
| GET | /users/:userId/squadrons | /users/:userId/squadrons | squadrons.ts |
| GET | /users/:userId/squadrons/count | /users/:userId/squadrons/count | squadrons.ts |
| GET | /stats | /stats | tickets.ts |
| GET | /by-number/:ticketNumber | /by-number/:ticketNumber | tickets.ts |
| GET | / | / | achievements.ts |
| POST | / | / | achievements.ts |
| GET | /:id | /:achievementId | achievements.ts |
| PUT | /:id | /:achievementId | achievements.ts |
| DELETE | /:id | /:achievementId | achievements.ts |
| POST | /:id/messages | /:id/messages | tickets.ts |
| PUT | /:id/assign | /:id/assign | tickets.ts |
| PUT | /:id/resolve | /:id/resolve | tickets.ts |
| GET | / | / | achievements.ts |
| GET | /:id | /:achievementId | achievements.ts |
| POST | / | / | achievements.ts |
| DELETE | /:id | /:achievementId | achievements.ts |
| GET | /:id/analytics | /:id/analytics | featureFlags.ts |
| POST | /auth/2fa/verify | /auth/2fa/verify | auth.ts |
| POST | /auth/2fa/disable | /auth/2fa/disable | auth.ts |
| POST | /auth/forgot-password | /auth/forgot-password | users.ts |
| GET | /auth/reset-password/:token | /auth/reset-password/:token | users.ts |
| POST | /auth/reset-password | /auth/reset-password | users.ts |
| GET | /users/me | /users/me | users.ts |
| GET | /users/me/activity | /users/me/activity | users.ts |
| GET | /users/me/activity/timeline | /users/me/activity/timeline | users.ts |
| GET | /users/me/activity/heatmap | /users/me/activity/heatmap | users.ts |
| GET | /users | /users | search.ts |
| GET | /users/search | /users/search | users.ts |
| GET | /users/:id | /users/:id | users.ts |
| POST | /users | /users | users.ts |
| PATCH | /users/:id | /users/:id | users.ts |
| DELETE | /users/:id | /users/:id | users.ts |
| PATCH | /users/:id/role | /users/:id/role | users.ts |
| GET | /users/:id/activity/timeline | /users/:id/activity/timeline | users.ts |
| GET | /users/:id/activity/heatmap | /users/:id/activity/heatmap | users.ts |
| POST | /users/search/advanced | /users/search/advanced | users.ts |
| GET | /users/suggestions/username/:partial | /users/suggestions/username/:partial | users.ts |
| GET | /users/:id/similar | /users/:id/similar | users.ts |
| POST | /users/:id/social/friend-request | /users/:id/social/friend-request | users.ts |

</details>

---

## Recommendations

- **463 endpoints still need migration.** Focus on high-priority auth and organization endpoints first.
- **Significant work remaining.** Focus on completing V2 API before deprecating V1.
- **664 new features in V2.** Document these new capabilities for users.

---

## Next Steps

1. **Immediate:**
   - Migrate 463 remaining V1 endpoints
   - Enable V1 deprecation warnings in app.ts
   - Update frontend to use V2 endpoints

2. **Short-term (1-3 months):**
   - Monitor V1 API usage via deprecation logs
   - Identify and update any third-party integrations
   - Set V1 sunset date

3. **Long-term (3-6 months):**
   - Remove V1 code after sunset date
   - Clean up deprecated middleware
   - Archive V1 documentation

---

*Report generated by analyze-api-migration.ts*
