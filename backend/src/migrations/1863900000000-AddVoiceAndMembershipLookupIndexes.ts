import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * AddVoiceAndMembershipLookupIndexes
 *
 * PR-6 Query/Index hardening for:
 * 1) Voice predicate scans (organizations/federations settings JSON)
 * 2) Membership lookup paths used by voice-access resolution
 *
 * Targeted call sites:
 * - voiceTimeTrackingJob.ts
 * - VoiceServerService.listAccessibleVoiceServers()
 * - VoiceServerService.checkPlatformMumbleAccess()
 * - VoiceServerService.requireUserFederationAccess()
 */
export class AddVoiceAndMembershipLookupIndexes1863900000000 implements MigrationInterface {
  name = 'AddVoiceAndMembershipLookupIndexes1863900000000';

  private quoteIdentifier(identifier: string): string {
    return `"${identifier.replace(/"/g, '""')}"`;
  }

  private async resolveColumnName(
    queryRunner: QueryRunner,
    tableName: string,
    desiredColumnName: string
  ): Promise<string | null> {
    const rows = await queryRunner.query(
      `
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = $1
        AND lower(column_name) = lower($2)
      ORDER BY CASE WHEN column_name = $2 THEN 0 ELSE 1 END, column_name
      LIMIT 1
      `,
      [tableName, desiredColumnName]
    );

    return (rows[0] as { column_name?: string } | undefined)?.column_name ?? null;
  }

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Voice ingest org scan: enabled + contributeToCAS predicates.
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_organizations_voice_cas_enabled"
      ON "organizations" ("id")
      WHERE (settings -> 'voiceServer' ->> 'enabled') = 'true'
        AND (settings -> 'voiceServer' ->> 'contributeToCAS') = 'true'
    `);

    // Shared voice org scan: enabled + sharing.enabled predicates.
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_organizations_voice_sharing_enabled"
      ON "organizations" ("id")
      WHERE (settings -> 'voiceServer' ->> 'enabled') = 'true'
        AND (settings -> 'voiceServer' -> 'sharing' ->> 'enabled') = 'true'
    `);

    // Federation voice scan: enabled predicate.
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_federations_voice_enabled"
      ON "federations" ("id")
      WHERE (settings -> 'voiceServer' ->> 'enabled') = 'true'
    `);

    // Shared federation voice scan: enabled + sharing.enabled predicates.
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_federations_voice_sharing_enabled"
      ON "federations" ("id")
      WHERE (settings -> 'voiceServer' ->> 'enabled') = 'true'
        AND (settings -> 'voiceServer' -> 'sharing' ->> 'enabled') = 'true'
    `);

    // Membership lookup (user + active + org target set).
    const membershipUserId = await this.resolveColumnName(
      queryRunner,
      'organization_memberships',
      'userId'
    );
    const membershipOrganizationId = await this.resolveColumnName(
      queryRunner,
      'organization_memberships',
      'organizationId'
    );
    const membershipIsActive = await this.resolveColumnName(
      queryRunner,
      'organization_memberships',
      'isActive'
    );

    if (membershipUserId && membershipOrganizationId && membershipIsActive) {
      await queryRunner.query(
        `CREATE INDEX IF NOT EXISTS ${this.quoteIdentifier('idx_org_memberships_user_active_org')} ON ${this.quoteIdentifier('organization_memberships')} (${this.quoteIdentifier(membershipUserId)}, ${this.quoteIdentifier(membershipOrganizationId)}) WHERE ${this.quoteIdentifier(membershipIsActive)} = true`
      );
    }

    // Federation lookup by org for active memberships.
    const federationMemberOrganizationId = await this.resolveColumnName(
      queryRunner,
      'federation_members',
      'organizationId'
    );
    const federationMemberFederationId = await this.resolveColumnName(
      queryRunner,
      'federation_members',
      'federationId'
    );
    const federationMemberStatus = await this.resolveColumnName(
      queryRunner,
      'federation_members',
      'status'
    );

    if (federationMemberOrganizationId && federationMemberFederationId && federationMemberStatus) {
      await queryRunner.query(
        `CREATE INDEX IF NOT EXISTS ${this.quoteIdentifier('idx_fed_members_org_active_fed')} ON ${this.quoteIdentifier('federation_members')} (${this.quoteIdentifier(federationMemberOrganizationId)}, ${this.quoteIdentifier(federationMemberFederationId)}) WHERE ${this.quoteIdentifier(federationMemberStatus)} = 'active'`
      );
    }

    // Federation lookup by federation for active memberships.
    if (federationMemberOrganizationId && federationMemberFederationId && federationMemberStatus) {
      await queryRunner.query(
        `CREATE INDEX IF NOT EXISTS ${this.quoteIdentifier('idx_fed_members_fed_active_org')} ON ${this.quoteIdentifier('federation_members')} (${this.quoteIdentifier(federationMemberFederationId)}, ${this.quoteIdentifier(federationMemberOrganizationId)}) WHERE ${this.quoteIdentifier(federationMemberStatus)} = 'active'`
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_fed_members_fed_active_org"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_fed_members_org_active_fed"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_org_memberships_user_active_org"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_federations_voice_sharing_enabled"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_federations_voice_enabled"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_organizations_voice_sharing_enabled"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_organizations_voice_cas_enabled"`);
  }
}
