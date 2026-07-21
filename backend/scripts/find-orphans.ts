/**
 * Find Orphans — Dangling Recruitment & Image Reference Cleanup
 *
 * Scans the database for two classes of orphan data that produce 404s in the UI:
 *
 *   1. Recruitment / activity orphans
 *      Rows in tables that reference an `activities.id` that no longer exists
 *      (or, for recruitment-specific reports, references an activity whose
 *      `activityType` is not RECRUITMENT).
 *
 *   2. Image-URL orphans
 *      Persisted columns containing `/api/v2/images/download/<filename>` URLs
 *      whose `<filename>` no longer exists in Azure Blob Storage AND is not
 *      present in the local uploads directory.
 *
 * Default mode is dry-run: nothing is modified. Pass `--apply` to perform the
 * cleanup inside a single transaction.
 *
 * Usage:
 *   npx ts-node scripts/find-orphans.ts                 # dry-run, all checks
 *   npx ts-node scripts/find-orphans.ts --mode=recruitment
 *   npx ts-node scripts/find-orphans.ts --mode=images
 *   npx ts-node scripts/find-orphans.ts --apply         # actually mutate
 *   npx ts-node scripts/find-orphans.ts --filename b0097a0e-ba5f-48f4-8733-b48fc8edac3a.png
 *   npx ts-node scripts/find-orphans.ts --activity-id 5cf31c70-1be0-4d95-a56c-caae79fa5be6
 *
 * The script must be run from the `backend/` directory so the existing
 * `AppDataSource` configuration and the local uploads dir resolve correctly.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

import { AppDataSource } from '../src/config/database';
import { AzureBlobService } from '../src/services/cloud/AzureBlobService';
import { logger } from '../src/utils/logger';

const azureBlobService = new AzureBlobService();

// ─── CLI parsing ─────────────────────────────────────────────────────────────

interface CliOptions {
  apply: boolean;
  mode: 'all' | 'recruitment' | 'images';
  activityId?: string;
  filename?: string;
}

function parseArgs(argv: string[]): CliOptions {
  const opts: CliOptions = { apply: false, mode: 'all' };
  for (const arg of argv.slice(2)) {
    if (arg === '--apply') opts.apply = true;
    else if (arg.startsWith('--mode=')) {
      const v = arg.slice('--mode='.length);
      if (v !== 'all' && v !== 'recruitment' && v !== 'images') {
        throw new Error(`Invalid --mode value: ${v}`);
      }
      opts.mode = v;
    } else if (arg.startsWith('--activity-id=')) {
      opts.activityId = arg.slice('--activity-id='.length);
    } else if (arg.startsWith('--filename=')) {
      opts.filename = arg.slice('--filename='.length);
    } else if (arg === '--help' || arg === '-h') {
      console.log(
        'Usage: ts-node scripts/find-orphans.ts [--mode=all|recruitment|images] [--apply] [--activity-id=<uuid>] [--filename=<file>]'
      );
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return opts;
}

// ─── Reference catalogues ────────────────────────────────────────────────────

/**
 * Tables (and column) that store a foreign-key-style reference to
 * `activities.id`. For each entry we find rows whose target activity is
 * missing, and additionally surface rows whose target activity exists but is
 * not of type 'recruitment' (these are not orphans, but help diagnose stale
 * recruitment IDs cached on the frontend).
 *
 * `nullable=true` means we clear the column on cleanup; otherwise we DELETE
 * the row (it cannot exist without its parent).
 */
interface ActivityRef {
  table: string;
  column: string;
  nullable: boolean;
}

const ACTIVITY_REFS: ActivityRef[] = [
  { table: 'activity_participants', column: 'activityId', nullable: false },
  { table: 'activity_reminders', column: 'activityId', nullable: false },
  { table: 'mirrored_activities', column: 'sourceActivityId', nullable: false },
  { table: 'mirrored_activities', column: 'mirrorActivityId', nullable: true },
  { table: 'bounties', column: 'linkedActivityId', nullable: true },
  { table: 'missions', column: 'linkedActivityId', nullable: true },
  { table: 'ship_loans', column: 'activityId', nullable: true },
];

/**
 * Persisted columns that store image URLs (or bare filenames) we manage in
 * Azure Blob Storage. Inferred from `@Column` definitions in `backend/src/models/`.
 *
 * Note: only columns that are NOT NULL must have values preserved; the script
 * sets dangling values to NULL, so any column listed here must be nullable.
 */
interface ImageRef {
  table: string;
  column: string;
}

const IMAGE_REFS: ImageRef[] = [
  { table: 'users', column: 'avatar' },
  { table: 'organizations', column: 'logoUrl' },
  { table: 'activities', column: 'bannerImageUrl' },
  { table: 'fleets', column: 'emblem' },
  { table: 'federations', column: 'logoUrl' },
  { table: 'announcements', column: 'imageUrl' },
  { table: 'commissary_items', column: 'imageUrl' },
  { table: 'ships', column: 'imageUrl' },
  { table: 'teams', column: 'emblem' },
  { table: 'webhooks', column: 'avatarUrl' },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

const LOCAL_UPLOADS_DIR = path.join(process.cwd(), 'data', 'uploads');

/**
 * Extract the blob filename from a value that may be either a full proxy URL
 * (`https://api.example.com/api/v2/images/download/<file>`) or a bare
 * filename. Returns `null` for values that are not managed by our image
 * service (e.g. external CDN URLs, RSI avatar URLs, etc.) — those are not
 * orphan candidates because we cannot delete the upstream file.
 */
function extractBlobFilename(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  // Full URL with our download proxy path
  const proxyMatch = /\/api\/v2\/images\/download\/([^/?#]+)/.exec(trimmed);
  if (proxyMatch) {
    try {
      return decodeURIComponent(proxyMatch[1]);
    } catch {
      return proxyMatch[1];
    }
  }

  // Bare UUID filename written by uploadController (e.g. `<uuid>.png`)
  if (/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}\.\w+$/i.test(trimmed)) {
    return trimmed;
  }

  // Anything else (external host, RSI CDN, gravatar, etc.) — out of scope.
  return null;
}

async function localImageExists(fileName: string): Promise<boolean> {
  const safeName = path.basename(fileName);
  const resolved = path.resolve(LOCAL_UPLOADS_DIR, safeName);
  const root = path.resolve(LOCAL_UPLOADS_DIR);
  if (resolved !== root && !resolved.startsWith(root + path.sep)) return false;
  return fs.promises
    .access(resolved)
    .then(() => true)
    .catch(() => false);
}

/**
 * Cache of filename → exists results so the same blob is not probed twice.
 */
const existenceCache = new Map<string, boolean>();

async function imageExistsAnywhere(fileName: string): Promise<boolean> {
  const cached = existenceCache.get(fileName);
  if (cached !== undefined) return cached;

  let exists = false;
  try {
    if (azureBlobService.isConfigured()) {
      exists = await azureBlobService.imageExists(fileName);
    }
  } catch (err) {
    logger.warn(
      `Azure existence check failed for ${fileName}: ${err instanceof Error ? err.message : String(err)}`
    );
  }
  if (!exists) {
    exists = await localImageExists(fileName);
  }
  existenceCache.set(fileName, exists);
  return exists;
}

function quoteIdent(name: string): string {
  // Identifiers in our schema are camelCase and must be double-quoted.
  return `"${name.replaceAll('"', '""')}"`;
}

// ─── Recruitment / activity orphan detection ─────────────────────────────────

interface ActivityOrphanReport {
  ref: ActivityRef;
  missingRows: number;
  nonRecruitmentRows: number;
  sampleMissingIds: string[];
  sampleNonRecruitmentIds: string[];
}

async function scanActivityRefs(activityIdFilter?: string): Promise<ActivityOrphanReport[]> {
  const reports: ActivityOrphanReport[] = [];
  for (const ref of ACTIVITY_REFS) {
    const col = quoteIdent(ref.column);
    const tbl = quoteIdent(ref.table);
    // Cast both sides to text in case the FK column is varchar while
    // activities.id is uuid (or vice versa). Same for any optional filter.
    const filter = activityIdFilter ? ` AND t.${col}::text = $1` : '';
    const params = activityIdFilter ? [activityIdFilter] : [];

    // Rows whose target activity is missing
    const missingRowsSql = `
      SELECT COUNT(*)::int AS count, ARRAY_AGG(t.${col}::text) FILTER (WHERE t.${col} IS NOT NULL) AS samples
      FROM ${tbl} t
      LEFT JOIN activities a ON a.id::text = t.${col}::text
      WHERE t.${col} IS NOT NULL
        AND a.id IS NULL
        ${filter}
    `;
    // Rows whose target activity exists but is not of recruitment type
    const nonRecruitmentSql = `
      SELECT COUNT(*)::int AS count, ARRAY_AGG(t.${col}::text) FILTER (WHERE t.${col} IS NOT NULL) AS samples
      FROM ${tbl} t
      INNER JOIN activities a ON a.id::text = t.${col}::text
      WHERE a."activityType" <> 'recruitment'
        ${filter}
    `;

    type CountRow = { count: number; samples: string[] | null };
    const missingRows: CountRow[] = await AppDataSource.query(missingRowsSql, params);
    const nonRecRows: CountRow[] = await AppDataSource.query(nonRecruitmentSql, params);
    const missingResult = missingRows[0];
    const nonRecResult = nonRecRows[0];

    reports.push({
      ref,
      missingRows: missingResult.count,
      nonRecruitmentRows: nonRecResult.count,
      sampleMissingIds: (missingResult.samples ?? []).slice(0, 5),
      sampleNonRecruitmentIds: (nonRecResult.samples ?? []).slice(0, 5),
    });
  }
  return reports;
}

async function applyActivityCleanup(reports: ActivityOrphanReport[]): Promise<void> {
  await AppDataSource.transaction(async manager => {
    for (const r of reports) {
      if (r.missingRows === 0) continue;
      const tbl = quoteIdent(r.ref.table);
      const col = quoteIdent(r.ref.column);
      if (r.ref.nullable) {
        const sql = `
          UPDATE ${tbl} SET ${col} = NULL
          WHERE ${col} IS NOT NULL
            AND ${col}::text NOT IN (SELECT id::text FROM activities)
        `;
        const result: unknown = await manager.query(sql);
        console.log(
          `  ✓ ${r.ref.table}.${r.ref.column}: cleared (raw result: ${JSON.stringify(result)})`
        );
      } else {
        const sql = `
          DELETE FROM ${tbl}
          WHERE ${col} IS NOT NULL
            AND ${col}::text NOT IN (SELECT id::text FROM activities)
        `;
        const result: unknown = await manager.query(sql);
        console.log(
          `  ✓ ${r.ref.table}.${r.ref.column}: deleted (raw result: ${JSON.stringify(result)})`
        );
      }
    }
  });
}

// ─── Image orphan detection ──────────────────────────────────────────────────

interface ImageOrphan {
  ref: ImageRef;
  rowId: string;
  value: string;
  filename: string;
}

type ImageRow = { id: string; value: string };

async function scanImageRef(
  ref: ImageRef,
  filenameFilter: string | undefined,
  orphans: ImageOrphan[]
): Promise<void> {
  const tbl = quoteIdent(ref.table);
  const col = quoteIdent(ref.column);

  // Skip silently if the table or column does not exist in the live schema.
  const existsRows: Array<{ exists: boolean }> = await AppDataSource.query(
    `SELECT EXISTS (
       SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = $1
         AND column_name = $2
     ) AS exists`,
    [ref.table, ref.column]
  );
  if (!existsRows[0]?.exists) {
    console.log(`  • ${ref.table}.${ref.column}: skipped (column not found)`);
    return;
  }

  const sql = `SELECT id, ${col} AS value FROM ${tbl} WHERE ${col} IS NOT NULL AND ${col} <> ''`;
  const rows: ImageRow[] = await AppDataSource.query(sql);
  let scanned = 0;
  let kept = 0;
  let missing = 0;
  for (const row of rows) {
    const filename = extractBlobFilename(row.value);
    if (!filename) continue;
    if (filenameFilter && filename !== filenameFilter) continue;
    scanned += 1;
    if (await imageExistsAnywhere(filename)) {
      kept += 1;
    } else {
      missing += 1;
      orphans.push({ ref, rowId: row.id, value: row.value, filename });
    }
  }
  if (scanned > 0) {
    console.log(
      `  • ${ref.table}.${ref.column}: scanned=${scanned} present=${kept} dangling=${missing}`
    );
  }
}

async function scanImageRefs(filenameFilter?: string): Promise<ImageOrphan[]> {
  const orphans: ImageOrphan[] = [];
  for (const ref of IMAGE_REFS) {
    await scanImageRef(ref, filenameFilter, orphans);
  }
  return orphans;
}

async function applyImageCleanup(orphans: ImageOrphan[]): Promise<void> {
  // Group by (table, column) to issue one UPDATE per group.
  const grouped = new Map<string, { ref: ImageRef; ids: string[] }>();
  for (const o of orphans) {
    const key = `${o.ref.table}.${o.ref.column}`;
    const entry = grouped.get(key) ?? { ref: o.ref, ids: [] };
    entry.ids.push(o.rowId);
    grouped.set(key, entry);
  }

  await AppDataSource.transaction(async manager => {
    for (const { ref, ids } of grouped.values()) {
      if (ids.length === 0) continue;
      const tbl = quoteIdent(ref.table);
      const col = quoteIdent(ref.column);
      const sql = `UPDATE ${tbl} SET ${col} = NULL WHERE id = ANY($1)`;
      const result: unknown = await manager.query(sql, [ids]);
      console.log(
        `  ✓ ${ref.table}.${ref.column}: nulled ${ids.length} row(s) (raw result: ${JSON.stringify(result)})`
      );
    }
  });
}

// ─── Main ────────────────────────────────────────────────────────────────────

function printActivityReports(reports: ActivityOrphanReport[]): void {
  console.log('── Activity / recruitment references ───────────────────');
  for (const r of reports) {
    console.log(
      `  • ${r.ref.table}.${r.ref.column}: missing=${r.missingRows} non-recruitment=${r.nonRecruitmentRows}`
    );
    if (r.sampleMissingIds.length > 0) {
      console.log(`      missing sample: ${r.sampleMissingIds.join(', ')}`);
    }
    if (r.sampleNonRecruitmentIds.length > 0) {
      console.log(`      non-recruitment sample: ${r.sampleNonRecruitmentIds.join(', ')}`);
    }
  }
  const totalMissing = reports.reduce((s, r) => s + r.missingRows, 0);
  console.log(`  Total dangling rows: ${totalMissing}`);
  console.log('');
}

function printImageOrphans(orphans: ImageOrphan[]): void {
  console.log('── Image URL references ────────────────────────────────');
  if (!azureBlobService.isConfigured()) {
    console.log('  ⚠ Azure Blob Storage is not configured — falling back to local FS only.');
  }
  console.log(`  Total dangling image references: ${orphans.length}`);
  for (const o of orphans.slice(0, 10)) {
    console.log(`      ${o.ref.table}#${o.rowId}: ${o.filename}`);
  }
  if (orphans.length > 10) {
    console.log(`      … and ${orphans.length - 10} more`);
  }
  console.log('');
}

function printHeader(opts: CliOptions): void {
  console.log('═══════════════════════════════════════════════════════');
  console.log('  Orphan Reference Scan');
  console.log('═══════════════════════════════════════════════════════');
  console.log(`  mode:  ${opts.mode}`);
  console.log(`  apply: ${opts.apply ? 'YES (will mutate database)' : 'no (dry-run)'}`);
  if (opts.activityId) console.log(`  activity-id filter: ${opts.activityId}`);
  if (opts.filename) console.log(`  filename filter:    ${opts.filename}`);
  console.log('');
}

async function runScan(opts: CliOptions): Promise<void> {
  const wantsRecruitment = opts.mode === 'all' || opts.mode === 'recruitment';
  const wantsImages = opts.mode === 'all' || opts.mode === 'images';

  let activityReports: ActivityOrphanReport[] = [];
  let imageOrphans: ImageOrphan[] = [];

  if (wantsRecruitment) {
    activityReports = await scanActivityRefs(opts.activityId);
    printActivityReports(activityReports);
  }
  if (wantsImages) {
    imageOrphans = await scanImageRefs(opts.filename);
    printImageOrphans(imageOrphans);
  }

  if (!opts.apply) {
    console.log('Dry-run complete. Re-run with --apply to perform cleanup.');
    return;
  }

  console.log('── Applying cleanup ────────────────────────────────────');
  if (wantsRecruitment) await applyActivityCleanup(activityReports);
  if (wantsImages) await applyImageCleanup(imageOrphans);
  console.log('  Done.');
}

async function main(): Promise<void> {
  const opts = parseArgs(process.argv);
  printHeader(opts);

  await AppDataSource.initialize();
  try {
    await runScan(opts);
  } finally {
    await AppDataSource.destroy();
  }
}

main().catch(err => {
  console.error('Orphan scan failed:', err);
  process.exit(1);
});
