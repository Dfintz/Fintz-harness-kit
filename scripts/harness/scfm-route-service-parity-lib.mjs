import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';

export const repoRoot = process.cwd();
export const routesDir = resolve(repoRoot, 'backend/dist/routes');
export const servicesDir = resolve(repoRoot, 'frontend/src/services');
export const manifestPath = resolve(
  repoRoot,
  '.github/harness/research/scfm-route-service-parity.manifest.json'
);

const backendOnlyByDesign = new Set([
  'dev.routes',
  'healthRoutes',
  'imageRoutes',
  'performanceRoutes',
  'tunnelRoutes',
  'webhookRoutes',
  'discordWebhookEventRoutes',
  'secretsRoutes',
  'tournamentRoutes',
  'rsiUserLinkBotRoutes',
]);

const routeAliasMatchers = {
  adminShipRoutes: ['shipServiceV2', 'shipCatalogueService'],
  allianceDiplomacyRoutes: ['allianceService', 'relationshipService'],
  cargoManifestRoutes: ['logisticsService'],
  contactRequestRoutes: ['ticketService', 'notificationService'],
  fleetLogisticsRoutes: ['logisticsService', 'fleetServiceV2'],
  matchmakingRoutes: ['socialLfgService'],
  miningOperationRoutes: ['miningService'],
  organizationInventoryRoutes: ['logisticsService'],
  orgRelationshipRoutes: ['relationshipService'],
  publicJobListingRoutes: ['opportunityService', 'recruitmentService'],
  reputationRoutes: ['orgTrustScoreService', 'userTrustScoreService'],
  shipDataRoutes: ['shipServiceV2', 'shipCatalogueService'],
};

function listBaseNames(dirPath) {
  return readdirSync(dirPath)
    .filter(name => name.endsWith('.js'))
    .map(name => name.replace(/\.js$/, ''))
    .sort((a, b) => a.localeCompare(b));
}

function stemForRoute(routeName) {
  return routeName.replace(/Routes$/, '').replace(/\.routes$/, '');
}

function inferMatches(routeName, stem, services) {
  const stemMatches = services.filter(service =>
    service.toLowerCase().includes(stem.toLowerCase())
  );
  const aliasCandidates = routeAliasMatchers[routeName] || [];
  const aliasMatches = aliasCandidates.filter(candidate => services.includes(candidate));
  const combined = [...new Set([...stemMatches, ...aliasMatches])].sort((a, b) =>
    a.localeCompare(b)
  );
  return { stemMatches, aliasMatches, combined };
}

function classify(routeName, combinedMatches) {
  if (combinedMatches.length > 0) {
    return 'adapter-present';
  }
  if (backendOnlyByDesign.has(routeName)) {
    return 'backend-only-by-design';
  }
  return 'frontend-adapter-needed';
}

export function buildReport() {
  if (!existsSync(routesDir)) {
    throw new Error(`Missing routes directory: ${routesDir}`);
  }
  if (!existsSync(servicesDir)) {
    throw new Error(`Missing services directory: ${servicesDir}`);
  }

  const routeNames = listBaseNames(routesDir);
  const serviceNames = readdirSync(servicesDir)
    .filter(name => /\.(ts|tsx)$/.test(name))
    .map(name => name.replace(/\.(ts|tsx)$/, ''))
    .sort((a, b) => a.localeCompare(b));

  const records = routeNames.map(routeName => {
    const stem = stemForRoute(routeName);
    const { stemMatches, aliasMatches, combined } = inferMatches(routeName, stem, serviceNames);
    return {
      route: routeName,
      stem,
      stemMatches,
      aliasMatches,
      matchedServices: combined,
      classification: classify(routeName, combined),
    };
  });

  return {
    generatedAt: new Date().toISOString(),
    source: {
      routesDir: 'backend/dist/routes',
      servicesDir: 'frontend/src/services',
    },
    classifications: {
      adapterPresent: 'Route has at least one frontend service match by stem or explicit alias map.',
      frontendAdapterNeeded: 'Route appears user-facing or operational with no mapped frontend service.',
      backendOnlyByDesign: 'Route intentionally backend/infrastructure-only for this app surface.',
    },
    summary: {
      routesTotal: records.length,
      servicesTotal: serviceNames.length,
      adapterPresent: records.filter(r => r.classification === 'adapter-present').length,
      frontendAdapterNeeded: records.filter(r => r.classification === 'frontend-adapter-needed').length,
      backendOnlyByDesign: records.filter(r => r.classification === 'backend-only-by-design').length,
    },
    records,
  };
}

export function writeManifest(report) {
  mkdirSync(dirname(manifestPath), { recursive: true });
  writeFileSync(manifestPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
}

export function readManifest() {
  if (!existsSync(manifestPath)) {
    throw new Error(`Manifest not found: ${manifestPath}`);
  }
  return JSON.parse(readFileSync(manifestPath, 'utf8'));
}

export function printSummary(report) {
  console.log(`routes=${report.summary.routesTotal}`);
  console.log(`services=${report.summary.servicesTotal}`);
  console.log(`adapter-present=${report.summary.adapterPresent}`);
  console.log(`frontend-adapter-needed=${report.summary.frontendAdapterNeeded}`);
  console.log(`backend-only-by-design=${report.summary.backendOnlyByDesign}`);

  const needed = report.records
    .filter(r => r.classification === 'frontend-adapter-needed')
    .map(r => r.route)
    .sort((a, b) => a.localeCompare(b));
  if (needed.length > 0) {
    console.log('frontend-adapter-needed routes:');
    for (const route of needed) {
      console.log(`- ${route}`);
    }
  }
}
