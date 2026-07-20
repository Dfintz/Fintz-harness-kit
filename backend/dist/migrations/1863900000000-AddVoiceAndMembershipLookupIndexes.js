"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AddVoiceAndMembershipLookupIndexes1863900000000 = void 0;
class AddVoiceAndMembershipLookupIndexes1863900000000 {
    name = 'AddVoiceAndMembershipLookupIndexes1863900000000';
    quoteIdentifier(identifier) {
        return `"${identifier.replace(/"/g, '""')}"`;
    }
    async resolveColumnName(queryRunner, tableName, desiredColumnName) {
        const rows = await queryRunner.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = $1
        AND lower(column_name) = lower($2)
      ORDER BY CASE WHEN column_name = $2 THEN 0 ELSE 1 END, column_name
      LIMIT 1
      `, [tableName, desiredColumnName]);
        return rows[0]?.column_name ?? null;
    }
    async up(queryRunner) {
        await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_organizations_voice_cas_enabled"
      ON "organizations" ("id")
      WHERE (settings -> 'voiceServer' ->> 'enabled') = 'true'
        AND (settings -> 'voiceServer' ->> 'contributeToCAS') = 'true'
    `);
        await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_organizations_voice_sharing_enabled"
      ON "organizations" ("id")
      WHERE (settings -> 'voiceServer' ->> 'enabled') = 'true'
        AND (settings -> 'voiceServer' -> 'sharing' ->> 'enabled') = 'true'
    `);
        await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_federations_voice_enabled"
      ON "federations" ("id")
      WHERE (settings -> 'voiceServer' ->> 'enabled') = 'true'
    `);
        await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_federations_voice_sharing_enabled"
      ON "federations" ("id")
      WHERE (settings -> 'voiceServer' ->> 'enabled') = 'true'
        AND (settings -> 'voiceServer' -> 'sharing' ->> 'enabled') = 'true'
    `);
        const membershipUserId = await this.resolveColumnName(queryRunner, 'organization_memberships', 'userId');
        const membershipOrganizationId = await this.resolveColumnName(queryRunner, 'organization_memberships', 'organizationId');
        const membershipIsActive = await this.resolveColumnName(queryRunner, 'organization_memberships', 'isActive');
        if (membershipUserId && membershipOrganizationId && membershipIsActive) {
            await queryRunner.query(`CREATE INDEX IF NOT EXISTS ${this.quoteIdentifier('idx_org_memberships_user_active_org')} ON ${this.quoteIdentifier('organization_memberships')} (${this.quoteIdentifier(membershipUserId)}, ${this.quoteIdentifier(membershipOrganizationId)}) WHERE ${this.quoteIdentifier(membershipIsActive)} = true`);
        }
        const federationMemberOrganizationId = await this.resolveColumnName(queryRunner, 'federation_members', 'organizationId');
        const federationMemberFederationId = await this.resolveColumnName(queryRunner, 'federation_members', 'federationId');
        const federationMemberStatus = await this.resolveColumnName(queryRunner, 'federation_members', 'status');
        if (federationMemberOrganizationId && federationMemberFederationId && federationMemberStatus) {
            await queryRunner.query(`CREATE INDEX IF NOT EXISTS ${this.quoteIdentifier('idx_fed_members_org_active_fed')} ON ${this.quoteIdentifier('federation_members')} (${this.quoteIdentifier(federationMemberOrganizationId)}, ${this.quoteIdentifier(federationMemberFederationId)}) WHERE ${this.quoteIdentifier(federationMemberStatus)} = 'active'`);
        }
        if (federationMemberOrganizationId && federationMemberFederationId && federationMemberStatus) {
            await queryRunner.query(`CREATE INDEX IF NOT EXISTS ${this.quoteIdentifier('idx_fed_members_fed_active_org')} ON ${this.quoteIdentifier('federation_members')} (${this.quoteIdentifier(federationMemberFederationId)}, ${this.quoteIdentifier(federationMemberOrganizationId)}) WHERE ${this.quoteIdentifier(federationMemberStatus)} = 'active'`);
        }
    }
    async down(queryRunner) {
        await queryRunner.query(`DROP INDEX IF EXISTS "idx_fed_members_fed_active_org"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "idx_fed_members_org_active_fed"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "idx_org_memberships_user_active_org"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "idx_federations_voice_sharing_enabled"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "idx_federations_voice_enabled"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "idx_organizations_voice_sharing_enabled"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "idx_organizations_voice_cas_enabled"`);
    }
}
exports.AddVoiceAndMembershipLookupIndexes1863900000000 = AddVoiceAndMembershipLookupIndexes1863900000000;
//# sourceMappingURL=1863900000000-AddVoiceAndMembershipLookupIndexes.js.map