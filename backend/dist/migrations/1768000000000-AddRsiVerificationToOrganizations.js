"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AddRsiVerificationToOrganizations1768000000000 = void 0;
const typeorm_1 = require("typeorm");
class AddRsiVerificationToOrganizations1768000000000 {
    async up(queryRunner) {
        const table = await queryRunner.getTable('organizations');
        const hasRsiSid = await queryRunner.hasColumn('organizations', 'rsiSid');
        const hasRsiVerified = await queryRunner.hasColumn('organizations', 'rsiVerified');
        const hasRsiVerifiedAt = await queryRunner.hasColumn('organizations', 'rsiVerifiedAt');
        const hasRsiVerificationCode = await queryRunner.hasColumn('organizations', 'rsiVerificationCode');
        const hasRsiVerificationCodeExpiresAt = await queryRunner.hasColumn('organizations', 'rsiVerificationCodeExpiresAt');
        if (!hasRsiSid) {
            await queryRunner.addColumn('organizations', new typeorm_1.TableColumn({
                name: 'rsiSid',
                type: 'varchar',
                isNullable: true,
                comment: 'RSI organization SID (Spectrum ID)',
            }));
        }
        if (!hasRsiVerified) {
            await queryRunner.addColumn('organizations', new typeorm_1.TableColumn({
                name: 'rsiVerified',
                type: 'boolean',
                default: false,
                isNullable: false,
                comment: 'Whether the RSI organization is verified',
            }));
        }
        if (!hasRsiVerifiedAt) {
            await queryRunner.addColumn('organizations', new typeorm_1.TableColumn({
                name: 'rsiVerifiedAt',
                type: 'timestamp',
                isNullable: true,
                comment: 'Timestamp when RSI organization was verified',
            }));
        }
        if (!hasRsiVerificationCode) {
            await queryRunner.addColumn('organizations', new typeorm_1.TableColumn({
                name: 'rsiVerificationCode',
                type: 'varchar',
                isNullable: true,
                comment: 'Temporary verification code for RSI organization verification',
            }));
        }
        if (!hasRsiVerificationCodeExpiresAt) {
            await queryRunner.addColumn('organizations', new typeorm_1.TableColumn({
                name: 'rsiVerificationCodeExpiresAt',
                type: 'timestamp',
                isNullable: true,
                comment: 'Expiration timestamp for verification code',
            }));
        }
        const hasIndex = table?.indices?.some(index => index.name === 'IDX_organizations_rsiSid');
        if (!hasIndex) {
            await queryRunner.createIndex('organizations', new typeorm_1.TableIndex({
                name: 'IDX_organizations_rsiSid',
                columnNames: ['rsiSid'],
            }));
        }
    }
    async down(queryRunner) {
        const table = await queryRunner.getTable('organizations');
        const hasIndex = table?.indices?.some(index => index.name === 'IDX_organizations_rsiSid');
        if (hasIndex) {
            await queryRunner.dropIndex('organizations', 'IDX_organizations_rsiSid');
        }
        if (await queryRunner.hasColumn('organizations', 'rsiVerificationCodeExpiresAt')) {
            await queryRunner.dropColumn('organizations', 'rsiVerificationCodeExpiresAt');
        }
        if (await queryRunner.hasColumn('organizations', 'rsiVerificationCode')) {
            await queryRunner.dropColumn('organizations', 'rsiVerificationCode');
        }
        if (await queryRunner.hasColumn('organizations', 'rsiVerifiedAt')) {
            await queryRunner.dropColumn('organizations', 'rsiVerifiedAt');
        }
        if (await queryRunner.hasColumn('organizations', 'rsiVerified')) {
            await queryRunner.dropColumn('organizations', 'rsiVerified');
        }
        if (await queryRunner.hasColumn('organizations', 'rsiSid')) {
            await queryRunner.dropColumn('organizations', 'rsiSid');
        }
    }
}
exports.AddRsiVerificationToOrganizations1768000000000 = AddRsiVerificationToOrganizations1768000000000;
//# sourceMappingURL=1768000000000-AddRsiVerificationToOrganizations.js.map