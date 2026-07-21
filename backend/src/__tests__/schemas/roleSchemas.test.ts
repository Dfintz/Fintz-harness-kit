import { roleSchemas } from '../../schemas/roleSchemas';

describe('roleSchemas', () => {
  describe('orgRoleIdParams', () => {
    it('should accept valid orgId and roleId params', () => {
      const result = roleSchemas.orgRoleIdParams.validate({
        orgId: '550e8400-e29b-41d4-a716-446655440000',
        roleId: '550e8400-e29b-41d4-a716-446655440001',
      });

      expect(result.error).toBeUndefined();
      expect(result.value.orgId).toBe('550e8400-e29b-41d4-a716-446655440000');
      expect(result.value.roleId).toBe('550e8400-e29b-41d4-a716-446655440001');
    });

    it('should reject invalid orgId', () => {
      const result = roleSchemas.orgRoleIdParams.validate({
        orgId: 'not-a-uuid',
        roleId: '550e8400-e29b-41d4-a716-446655440001',
      });

      expect(result.error).toBeDefined();
      expect(result.error?.message).toContain('orgId must be a valid UUID');
    });

    it('should reject extra params', () => {
      const result = roleSchemas.orgRoleIdParams.validate({
        orgId: '550e8400-e29b-41d4-a716-446655440000',
        roleId: '550e8400-e29b-41d4-a716-446655440001',
        extra: 'value',
      });

      expect(result.error).toBeDefined();
      expect(result.error?.message).toContain('"extra" is not allowed');
    });
  });
});
