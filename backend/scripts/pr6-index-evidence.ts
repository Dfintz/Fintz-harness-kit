import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { Client } from 'pg';

import { AddVoiceAndMembershipLookupIndexes1863900000000 } from '../src/migrations/1863900000000-AddVoiceAndMembershipLookupIndexes';

type ExplainPlanRow = {
  'QUERY PLAN': Array<Record<string, unknown>>;
};

type PlanSummary = {
  label: string;
  nodeTypes: string[];
  startupCost: number;
  totalCost: number;
  actualTotalTime: number;
};

const dbConfig = {
  host: process.env.DB_HOST ?? 'localhost',
  port: Number(process.env.DB_PORT ?? 5432),
  user: process.env.DB_USER ?? 'dev_user',
  password: process.env.DB_PASSWORD ?? process.env.PGPASSWORD,
  database: process.env.DB_NAME ?? 'star_citizen_db',
};

function collectNodeTypes(node: Record<string, unknown>, out: Set<string>): void {
  const nodeType = node['Node Type'];
  if (typeof nodeType === 'string') {
    out.add(nodeType);
  }

  const plans = node['Plans'];
  if (Array.isArray(plans)) {
    for (const child of plans) {
      if (child && typeof child === 'object') {
        collectNodeTypes(child as Record<string, unknown>, out);
      }
    }
  }
}

async function runExplain(client: Client, label: string, sql: string): Promise<PlanSummary> {
  const query = `EXPLAIN (ANALYZE, COSTS, BUFFERS, FORMAT JSON) ${sql}`;
  const result = await client.query<ExplainPlanRow>(query);
  const planRoot = result.rows[0]?.['QUERY PLAN']?.[0];

  if (!planRoot || typeof planRoot !== 'object') {
    throw new Error(`Explain output missing for ${label}`);
  }

  const plan = planRoot['Plan'];
  if (!plan || typeof plan !== 'object') {
    throw new Error(`Plan node missing for ${label}`);
  }

  const typedPlan = plan as Record<string, unknown>;
  const nodeTypes = new Set<string>();
  collectNodeTypes(typedPlan, nodeTypes);

  return {
    label,
    nodeTypes: [...nodeTypes],
    startupCost: Number(typedPlan['Startup Cost'] ?? 0),
    totalCost: Number(typedPlan['Total Cost'] ?? 0),
    actualTotalTime: Number(typedPlan['Actual Total Time'] ?? 0),
  };
}

function asMarkdownTable(before: PlanSummary[], after: PlanSummary[]): string {
  const rows = before.map((b, index) => {
    const a = after[index];
    const costDelta = b.totalCost === 0 ? 0 : ((b.totalCost - a.totalCost) / b.totalCost) * 100;
    const timeDelta =
      b.actualTotalTime === 0
        ? 0
        : ((b.actualTotalTime - a.actualTotalTime) / b.actualTotalTime) * 100;

    return `| ${b.label} | ${b.nodeTypes.join(', ')} | ${a.nodeTypes.join(', ')} | ${b.totalCost.toFixed(2)} | ${a.totalCost.toFixed(2)} | ${costDelta.toFixed(2)}% | ${b.actualTotalTime.toFixed(3)} ms | ${a.actualTotalTime.toFixed(3)} ms | ${timeDelta.toFixed(2)}% |`;
  });

  return [
    '| Query | Before Node Types | After Node Types | Before Total Cost | After Total Cost | Cost Delta | Before Actual Time | After Actual Time | Time Delta |',
    '| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |',
    ...rows,
  ].join('\n');
}

async function main(): Promise<void> {
  const client = new Client(dbConfig);
  await client.connect();

  try {
    // Use temp tables to isolate evidence collection from the real schema.
    await client.query(`
      CREATE TEMP TABLE organizations (
        id text PRIMARY KEY,
        settings jsonb
      )
    `);

    await client.query(`
      CREATE TEMP TABLE federations (
        id text PRIMARY KEY,
        settings jsonb
      )
    `);

    await client.query(`
      CREATE TEMP TABLE organization_memberships (
        "userId" text NOT NULL,
        "organizationId" text NOT NULL,
        "isActive" boolean NOT NULL
      )
    `);

    await client.query(`
      CREATE TEMP TABLE federation_members (
        "federationId" text NOT NULL,
        "organizationId" text NOT NULL,
        "status" text NOT NULL
      )
    `);

    await client.query(`
      INSERT INTO organizations (id, settings)
      SELECT concat('org-id-', i),
        jsonb_build_object(
          'voiceServer',
          jsonb_build_object(
            'enabled', CASE WHEN i % 2 = 0 THEN 'true' ELSE 'false' END,
            'contributeToCAS', CASE WHEN i % 5 = 0 THEN 'true' ELSE 'false' END,
            'sharing', jsonb_build_object('enabled', CASE WHEN i % 7 = 0 THEN 'true' ELSE 'false' END)
          )
        )
      FROM generate_series(1, 25000) AS i
    `);

    await client.query(`
      INSERT INTO federations (id, settings)
      SELECT concat('fed-id-', i),
        jsonb_build_object(
          'voiceServer',
          jsonb_build_object(
            'enabled', CASE WHEN i % 2 = 0 THEN 'true' ELSE 'false' END,
            'sharing', jsonb_build_object('enabled', CASE WHEN i % 4 = 0 THEN 'true' ELSE 'false' END)
          )
        )
      FROM generate_series(1, 12000) AS i
    `);

    await client.query(`
      INSERT INTO organization_memberships ("userId", "organizationId", "isActive")
      SELECT
        concat('user-', ((i - 1) % 3000) + 1),
        concat('org-', ((i - 1) % 5000) + 1),
        (i % 3) <> 0
      FROM generate_series(1, 180000) AS i
    `);

    await client.query(`
      INSERT INTO federation_members ("federationId", "organizationId", "status")
      SELECT
        concat('fed-', ((i - 1) % 700) + 1),
        concat('org-', ((i - 1) % 5000) + 1),
        CASE WHEN i % 4 = 0 THEN 'pending' ELSE 'active' END
      FROM generate_series(1, 140000) AS i
    `);

    const explainQueries: Array<{ label: string; sql: string }> = [
      {
        label: 'voice_ingest_org_scan',
        sql: `
          SELECT id
          FROM organizations org
          WHERE org.settings->'voiceServer'->>'contributeToCAS' = 'true'
            AND org.settings->'voiceServer'->>'enabled' = 'true'
        `,
      },
      {
        label: 'voice_shared_org_scan',
        sql: `
          SELECT id
          FROM organizations org
          WHERE org.settings->'voiceServer'->>'enabled' = 'true'
            AND org.settings->'voiceServer'->'sharing'->>'enabled' = 'true'
        `,
      },
      {
        label: 'membership_user_active_org_lookup',
        sql: `
          SELECT "organizationId"
          FROM organization_memberships om
          WHERE om."userId" = 'user-42'
            AND om."isActive" = true
            AND om."organizationId" IN ('org-10', 'org-11', 'org-12', 'org-13', 'org-14')
        `,
      },
      {
        label: 'federation_members_org_active_lookup',
        sql: `
          SELECT "federationId"
          FROM federation_members fm
          WHERE fm."organizationId" IN ('org-10', 'org-11', 'org-12')
            AND fm."status" = 'active'
        `,
      },
      {
        label: 'federation_members_fed_active_lookup',
        sql: `
          SELECT "organizationId"
          FROM federation_members fm
          WHERE fm."federationId" = 'fed-120'
            AND fm."status" = 'active'
        `,
      },
    ];

    const beforePlans: PlanSummary[] = [];
    for (const query of explainQueries) {
      beforePlans.push(await runExplain(client, query.label, query.sql));
    }

    const migration = new AddVoiceAndMembershipLookupIndexes1863900000000();
    const queryRunner = {
      query: async (sql: string) => client.query(sql),
    };

    await migration.up(queryRunner as never);

    const afterPlans: PlanSummary[] = [];
    for (const query of explainQueries) {
      afterPlans.push(await runExplain(client, query.label, query.sql));
    }

    // Validate down path removes all created indexes.
    await migration.down(queryRunner as never);
    const droppedCheck = await client.query<{
      indexname: string;
    }>(`
      SELECT indexname
      FROM pg_indexes
      WHERE schemaname LIKE 'pg_temp%'
        AND indexname IN (
          'idx_organizations_voice_cas_enabled',
          'idx_organizations_voice_sharing_enabled',
          'idx_federations_voice_enabled',
          'idx_federations_voice_sharing_enabled',
          'idx_org_memberships_user_active_org',
          'idx_fed_members_org_active_fed',
          'idx_fed_members_fed_active_org'
        )
    `);

    if (droppedCheck.rows.length > 0) {
      throw new Error(`Down migration left indexes behind: ${droppedCheck.rows.map(r => r.indexname).join(', ')}`);
    }

    const markdown = [
      '# PR-6 Explain/Analyze Evidence',
      '',
      `Generated on: ${new Date().toISOString()}`,
      '',
      '## Environment',
      '',
      `- host: ${dbConfig.host}`,
      `- port: ${dbConfig.port}`,
      `- database: ${dbConfig.database}`,
      '',
      '## Before/After Query Plan Metrics',
      '',
      asMarkdownTable(beforePlans, afterPlans),
      '',
      '## Migration Validation',
      '',
      '- `up` executed against representative temp tables',
      '- `down` executed and index cleanup verified in `pg_indexes`',
    ].join('\n');

    const outputPath = join(
      process.cwd(),
      '..',
      'docs',
      'PR6_QUERY_INDEX_EVIDENCE.md'
    );
    writeFileSync(outputPath, `${markdown}\n`, 'utf8');

    console.log(`PR6 evidence written: ${outputPath}`);
  } finally {
    await client.end();
  }
}

main().catch(error => {
  console.error('Failed to collect PR6 evidence', error instanceof Error ? error.message : error);
  process.exit(1);
});
