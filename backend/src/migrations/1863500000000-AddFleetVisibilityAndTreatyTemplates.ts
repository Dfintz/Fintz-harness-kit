import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

/**
 * Add fleet visibility rules and treaty templates.
 *
 * Fleet visibility rules allow fine-grained control over who can see a fleet:
 * - Organization scope: based on member security level (rank)
 * - Alliance scope: visible to a specific allied organization
 * - Federation scope: visible to all member orgs of a federation
 *
 * Treaty templates provide reusable agreement templates for alliances and federations,
 * including built-in templates and custom org-created templates.
 */
export class AddFleetVisibilityAndTreatyTemplates1863500000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── Fleet Visibility Rules ─────────────────────────────────
    await queryRunner.createTable(
      new Table({
        name: 'fleet_visibility_rules',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'uuid_generate_v4()',
          },
          {
            name: 'fleetId',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'organizationId',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'scope',
            type: 'varchar',
            isNullable: false,
          },
          {
            name: 'minSecurityLevel',
            type: 'int',
            isNullable: true,
          },
          {
            name: 'targetAllianceOrgId',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'targetFederationId',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'accessLevel',
            type: 'varchar',
            default: "'summary'",
          },
          {
            name: 'isActive',
            type: 'boolean',
            default: true,
          },
          {
            name: 'createdAt',
            type: 'timestamp',
            default: 'now()',
          },
          {
            name: 'updatedAt',
            type: 'timestamp',
            default: 'now()',
          },
        ],
        foreignKeys: [
          {
            name: 'FK_fvr_fleet',
            columnNames: ['fleetId'],
            referencedTableName: 'fleets',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          },
        ],
      }),
      true
    );

    await queryRunner.createIndices('fleet_visibility_rules', [
      new TableIndex({ name: 'idx_fvr_fleet', columnNames: ['fleetId'] }),
      new TableIndex({ name: 'idx_fvr_org', columnNames: ['organizationId'] }),
      new TableIndex({
        name: 'idx_fvr_fleet_scope',
        columnNames: ['fleetId', 'scope'],
      }),
      new TableIndex({
        name: 'idx_fvr_target_alliance',
        columnNames: ['targetAllianceOrgId'],
      }),
      new TableIndex({
        name: 'idx_fvr_target_federation',
        columnNames: ['targetFederationId'],
      }),
    ]);

    // ── Treaty Templates ───────────────────────────────────────
    await queryRunner.createTable(
      new Table({
        name: 'treaty_templates',
        columns: [
          {
            name: 'id',
            type: 'varchar',
            isPrimary: true,
          },
          {
            name: 'name',
            type: 'varchar',
            isNullable: false,
          },
          {
            name: 'description',
            type: 'text',
            isNullable: false,
          },
          {
            name: 'category',
            type: 'varchar',
            isNullable: false,
          },
          {
            name: 'scope',
            type: 'varchar',
            default: "'both'",
          },
          {
            name: 'clauses',
            type: 'jsonb',
            default: "'[]'",
          },
          {
            name: 'isBuiltIn',
            type: 'boolean',
            default: false,
          },
          {
            name: 'organizationId',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'isPublished',
            type: 'boolean',
            default: false,
          },
          {
            name: 'version',
            type: 'int',
            default: 1,
          },
          {
            name: 'tags',
            type: 'text',
            default: "''",
          },
          {
            name: 'createdAt',
            type: 'timestamp',
            default: 'now()',
          },
          {
            name: 'updatedAt',
            type: 'timestamp',
            default: 'now()',
          },
        ],
      }),
      true
    );

    await queryRunner.createIndices('treaty_templates', [
      new TableIndex({ name: 'idx_treaty_tpl_org', columnNames: ['organizationId'] }),
      new TableIndex({ name: 'idx_treaty_tpl_category', columnNames: ['category'] }),
      new TableIndex({ name: 'idx_treaty_tpl_scope', columnNames: ['scope'] }),
      new TableIndex({ name: 'idx_treaty_tpl_builtin', columnNames: ['isBuiltIn'] }),
      new TableIndex({ name: 'idx_treaty_tpl_published', columnNames: ['isPublished'] }),
    ]);

    // ── Seed Built-In Treaty Templates ─────────────────────────
    await queryRunner.query(`
      INSERT INTO treaty_templates (id, name, description, category, scope, clauses, "isBuiltIn", "isPublished", version, tags)
      VALUES
      (
        'builtin-mutual-defense',
        'Standard Mutual Defense Pact',
        'A comprehensive mutual defense agreement obligating signatories to assist each other when attacked.',
        'mutual_defense',
        'both',
        '${JSON.stringify([
          {
            id: 'md-1',
            title: 'Defense Obligation',
            text: 'All signatories agree to provide military assistance when any signatory is attacked by a hostile entity.',
            isRequired: true,
            sortOrder: 1,
          },
          {
            id: 'md-2',
            title: 'Response Time',
            text: 'Signatories shall mobilize defense forces within 24 hours of receiving a valid distress call.',
            isRequired: true,
            sortOrder: 2,
          },
          {
            id: 'md-3',
            title: 'Intelligence Sharing',
            text: 'Signatories agree to share relevant threat intelligence regarding known hostile entities.',
            isRequired: false,
            sortOrder: 3,
          },
          {
            id: 'md-4',
            title: 'Joint Command Structure',
            text: 'During combined operations, a joint command structure will be established with rotating leadership.',
            isRequired: false,
            sortOrder: 4,
          },
          {
            id: 'md-5',
            title: 'Withdrawal Clause',
            text: 'Any signatory may withdraw from this pact with 7 days written notice.',
            isRequired: true,
            sortOrder: 5,
          },
        ]).replaceAll("'", "''")}',
        true,
        true,
        1,
        'defense,military,protection'
      ),
      (
        'builtin-trade-agreement',
        'Standard Trade Agreement',
        'A trade agreement establishing preferential trading terms and resource sharing between signatories.',
        'trade',
        'both',
        '${JSON.stringify([
          {
            id: 'ta-1',
            title: 'Preferential Pricing',
            text: 'Signatories agree to offer each other preferential pricing on traded goods, with a minimum discount of 10% off market rates.',
            isRequired: true,
            sortOrder: 1,
          },
          {
            id: 'ta-2',
            title: 'Trade Route Sharing',
            text: 'Signatories agree to share known safe trade routes and provide escort services upon request.',
            isRequired: false,
            sortOrder: 2,
          },
          {
            id: 'ta-3',
            title: 'Resource Priority',
            text: 'When resources are scarce, signatories agree to prioritize fulfilling orders from fellow signatories.',
            isRequired: false,
            sortOrder: 3,
          },
          {
            id: 'ta-4',
            title: 'Dispute Resolution',
            text: 'Trade disputes shall be resolved through arbitration by a mutually agreed neutral party.',
            isRequired: true,
            sortOrder: 4,
          },
          {
            id: 'ta-5',
            title: 'Duration and Renewal',
            text: 'This agreement is valid for 90 days and automatically renews unless either party provides 14 days notice of termination.',
            isRequired: true,
            sortOrder: 5,
          },
        ]).replaceAll("'", "''")}',
        true,
        true,
        1,
        'trade,commerce,resources'
      ),
      (
        'builtin-non-aggression',
        'Standard Non-Aggression Pact',
        'A non-aggression pact ensuring peaceful coexistence and conflict avoidance between signatories.',
        'non_aggression',
        'both',
        '${JSON.stringify([
          {
            id: 'na-1',
            title: 'Non-Aggression Commitment',
            text: 'Signatories agree to refrain from hostile actions against each other, including but not limited to combat, piracy, and sabotage.',
            isRequired: true,
            sortOrder: 1,
          },
          {
            id: 'na-2',
            title: 'Territory Respect',
            text: "Signatories agree to respect each other's claimed operational areas and avoid unauthorized incursions.",
            isRequired: true,
            sortOrder: 2,
          },
          {
            id: 'na-3',
            title: 'Incident Reporting',
            text: 'Any incidents between members shall be reported through diplomatic channels within 48 hours.',
            isRequired: false,
            sortOrder: 3,
          },
          {
            id: 'na-4',
            title: 'Compensation',
            text: 'In the event of accidental hostilities, the aggressing party agrees to provide fair compensation for damages.',
            isRequired: false,
            sortOrder: 4,
          },
          {
            id: 'na-5',
            title: 'Violation Consequences',
            text: 'Repeated violations may result in suspension or termination of this pact, as determined by the affected party.',
            isRequired: true,
            sortOrder: 5,
          },
        ]).replaceAll("'", "''")}',
        true,
        true,
        1,
        'peace,non-aggression,ceasefire'
      ),
      (
        'builtin-resource-sharing',
        'Standard Resource Sharing Agreement',
        'An agreement for sharing mining, salvage, and other resource-gathering operations and proceeds.',
        'resource_sharing',
        'both',
        '${JSON.stringify([
          {
            id: 'rs-1',
            title: 'Resource Access',
            text: 'Signatories agree to grant each other access to shared mining and salvage sites.',
            isRequired: true,
            sortOrder: 1,
          },
          {
            id: 'rs-2',
            title: 'Profit Distribution',
            text: 'Proceeds from shared operations shall be distributed proportionally based on contribution.',
            isRequired: true,
            sortOrder: 2,
          },
          {
            id: 'rs-3',
            title: 'Equipment Sharing',
            text: 'Signatories may request use of specialized equipment from other signatories for joint operations.',
            isRequired: false,
            sortOrder: 3,
          },
          {
            id: 'rs-4',
            title: 'Operational Coordination',
            text: 'Joint resource operations require advance coordination and agreement on extraction plans.',
            isRequired: false,
            sortOrder: 4,
          },
        ]).replaceAll("'", "''")}',
        true,
        true,
        1,
        'mining,salvage,resources,sharing'
      ),
      (
        'builtin-intel-sharing',
        'Standard Intel Sharing Agreement',
        'An agreement for sharing intelligence on threats, targets, and operational information.',
        'intel_sharing',
        'both',
        '${JSON.stringify([
          {
            id: 'is-1',
            title: 'Intel Classification',
            text: 'Shared intelligence shall be classified as: Public, Restricted, or Confidential, with handling requirements for each level.',
            isRequired: true,
            sortOrder: 1,
          },
          {
            id: 'is-2',
            title: 'Sharing Obligations',
            text: 'Signatories agree to share threat intelligence regarding hostile entities operating in shared operational areas.',
            isRequired: true,
            sortOrder: 2,
          },
          {
            id: 'is-3',
            title: 'Confidentiality',
            text: 'Confidential intel shall not be shared outside the signatories without explicit written consent.',
            isRequired: true,
            sortOrder: 3,
          },
          {
            id: 'is-4',
            title: 'Intel Validation',
            text: 'Intel providers should indicate confidence level (confirmed, probable, unverified) for all shared reports.',
            isRequired: false,
            sortOrder: 4,
          },
        ]).replaceAll("'", "''")}',
        true,
        true,
        1,
        'intel,intelligence,information,security'
      ),
      (
        'builtin-military-cooperation',
        'Standard Military Cooperation Agreement',
        'A military cooperation agreement for joint operations, training, and force coordination.',
        'military_cooperation',
        'both',
        '${JSON.stringify([
          {
            id: 'mc-1',
            title: 'Joint Operations',
            text: 'Signatories agree to participate in planned joint military operations when capacity allows.',
            isRequired: true,
            sortOrder: 1,
          },
          {
            id: 'mc-2',
            title: 'Fleet Coordination',
            text: 'During joint operations, fleet compositions and roles shall be coordinated through designated fleet commanders.',
            isRequired: true,
            sortOrder: 2,
          },
          {
            id: 'mc-3',
            title: 'Training Exercises',
            text: 'Signatories agree to conduct regular joint training exercises to improve coordination and readiness.',
            isRequired: false,
            sortOrder: 3,
          },
          {
            id: 'mc-4',
            title: 'Rules of Engagement',
            text: 'Joint operations shall follow agreed-upon rules of engagement established before each operation.',
            isRequired: false,
            sortOrder: 4,
          },
          {
            id: 'mc-5',
            title: 'After-Action Review',
            text: 'Joint operations shall be followed by an after-action review to identify improvements.',
            isRequired: false,
            sortOrder: 5,
          },
        ]).replaceAll("'", "''")}',
        true,
        true,
        1,
        'military,operations,joint,training'
      );
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('treaty_templates', true);
    await queryRunner.dropTable('fleet_visibility_rules', true);
  }
}
