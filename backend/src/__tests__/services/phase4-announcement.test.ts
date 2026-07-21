/**
 * Phase 4 Tests: Announcement Templates & Global Broadcast
 * 
 * Tests for the Discord Announcement System Phase 4 features:
 * - Template CRUD operations
 * - Global broadcast functionality
 * - Platform Admin permission checks
 */
import { AnnouncementTemplate } from '../../models/AnnouncementTemplate';

describe('AnnouncementTemplate Model', () => {
    describe('isAvailableTo', () => {
        it('should return true for global templates regardless of organization', () => {
            const template = new AnnouncementTemplate();
            template.isGlobal = true;
            template.organizationId = null;

            expect(template.isAvailableTo('any-org-id')).toBe(true);
            expect(template.isAvailableTo('another-org')).toBe(true);
        });

        it('should return true for matching organization templates', () => {
            const template = new AnnouncementTemplate();
            template.isGlobal = false;
            template.organizationId = 'org-123';

            expect(template.isAvailableTo('org-123')).toBe(true);
        });

        it('should return false for non-matching organization templates', () => {
            const template = new AnnouncementTemplate();
            template.isGlobal = false;
            template.organizationId = 'org-123';

            expect(template.isAvailableTo('different-org')).toBe(false);
            expect(template.isAvailableTo('another-org')).toBe(false);
        });
    });

    describe('canBeModifiedBy', () => {
        it('should allow Platform Admin to modify any template', () => {
            const template = new AnnouncementTemplate();
            template.isGlobal = true;
            template.createdBy = 'admin-456';

            // Platform admins can modify any template
            expect(template.canBeModifiedBy('any-user', true)).toBe(true);
            expect(template.canBeModifiedBy('different-admin', true)).toBe(true);
        });

        it('should allow creator to modify their own organization template', () => {
            const template = new AnnouncementTemplate();
            template.isGlobal = false;
            template.organizationId = 'org-123';
            template.createdBy = 'user-789';

            expect(template.canBeModifiedBy('user-789', false)).toBe(true);
        });

        it('should not allow non-admin to modify global templates', () => {
            const template = new AnnouncementTemplate();
            template.isGlobal = true;
            template.createdBy = 'admin-123';

            // Regular users cannot modify global templates
            expect(template.canBeModifiedBy('regular-user', false)).toBe(false);
            expect(template.canBeModifiedBy(template.createdBy, false)).toBe(false);
        });

        it('should not allow non-creator to modify organization templates', () => {
            const template = new AnnouncementTemplate();
            template.isGlobal = false;
            template.organizationId = 'org-123';
            template.createdBy = 'user-789';

            // Other users in org cannot modify unless Platform Admin
            expect(template.canBeModifiedBy('other-user', false)).toBe(false);
        });
    });

    describe('Template Properties', () => {
        it('should have correct structure for global template', () => {
            const template = new AnnouncementTemplate();
            template.isGlobal = true;
            
            expect(template.isGlobal).toBe(true);
        });

        it('should allow null organizationId for global templates', () => {
            const template = new AnnouncementTemplate();
            template.isGlobal = true;
            template.organizationId = null;
            
            expect(template.organizationId).toBeNull();
            expect(template.isGlobal).toBe(true);
        });

        it('should support embed configuration', () => {
            const template = new AnnouncementTemplate();
            template.embedConfig = {
                color: '#FF5500',
                thumbnailUrl: 'https://example.com/thumb.png',
                imageUrl: 'https://example.com/image.png',
                timestamp: true
            };

            expect(template.embedConfig).toBeDefined();
            expect(template.embedConfig.color).toBe('#FF5500');
            expect(template.embedConfig.timestamp).toBe(true);
        });

        it('should support optional title', () => {
            const template = new AnnouncementTemplate();
            template.name = 'Test Template';
            template.content = 'Template content';
            template.title = undefined;

            expect(template.title).toBeUndefined();
            expect(template.name).toBe('Test Template');
        });

        it('should track creator information', () => {
            const template = new AnnouncementTemplate();
            template.createdBy = 'user-123';
            template.createdByName = 'Test User';

            expect(template.createdBy).toBe('user-123');
            expect(template.createdByName).toBe('Test User');
        });

        it('should support soft delete', () => {
            const template = new AnnouncementTemplate();
            template.deletedAt = new Date();
            template.deletedBy = 'admin-user';

            expect(template.deletedAt).toBeInstanceOf(Date);
            expect(template.deletedBy).toBe('admin-user');
        });
    });
});

describe('Announcement Schemas - Phase 4', () => {
    // We import the schemas to test validation
    let announcementSchemas: typeof import('../../schemas/announcementSchemas').announcementSchemas;

    beforeAll(async () => {
        const module = await import('../../schemas/announcementSchemas');
        announcementSchemas = module.announcementSchemas;
    });

    describe('createTemplate schema', () => {
        it('should validate a valid template creation request', () => {
            const validData = {
                name: 'Weekly Update Template',
                content: 'This is the content for weekly updates',
                title: 'Weekly Update',
                isGlobal: false
            };

            const result = announcementSchemas.createTemplate.validate(validData);
            expect(result.error).toBeUndefined();
            expect(result.value.name).toBe(validData.name);
        });

        it('should require name field', () => {
            const invalidData = {
                content: 'Content without name'
            };

            const result = announcementSchemas.createTemplate.validate(invalidData);
            expect(result.error).toBeDefined();
            expect(result.error?.message).toContain('name');
        });

        it('should require content field', () => {
            const invalidData = {
                name: 'Template without content'
            };

            const result = announcementSchemas.createTemplate.validate(invalidData);
            expect(result.error).toBeDefined();
            expect(result.error?.message).toContain('content');
        });

        it('should enforce name length limit', () => {
            const invalidData = {
                name: 'A'.repeat(101), // Over 100 chars
                content: 'Valid content'
            };

            const result = announcementSchemas.createTemplate.validate(invalidData);
            expect(result.error).toBeDefined();
            expect(result.error?.message).toContain('100');
        });

        it('should enforce content length limit', () => {
            const invalidData = {
                name: 'Valid name',
                content: 'A'.repeat(4097) // Over 4096 chars
            };

            const result = announcementSchemas.createTemplate.validate(invalidData);
            expect(result.error).toBeDefined();
            expect(result.error?.message).toContain('4096');
        });

        it('should accept valid embed config', () => {
            const validData = {
                name: 'Template with embed',
                content: 'Content here',
                embedConfig: {
                    color: '#FF5500',
                    timestamp: true
                }
            };

            const result = announcementSchemas.createTemplate.validate(validData);
            expect(result.error).toBeUndefined();
            expect(result.value.embedConfig).toBeDefined();
        });

        it('should reject invalid color format', () => {
            const invalidData = {
                name: 'Template',
                content: 'Content',
                embedConfig: {
                    color: 'invalid-color'
                }
            };

            const result = announcementSchemas.createTemplate.validate(invalidData);
            expect(result.error).toBeDefined();
            expect(result.error?.message).toContain('hex');
        });
    });

    describe('updateTemplate schema', () => {
        it('should allow partial updates', () => {
            const validData = {
                name: 'Updated Name'
            };

            const result = announcementSchemas.updateTemplate.validate(validData);
            expect(result.error).toBeUndefined();
        });

        it('should allow empty updates', () => {
            const validData = {};

            const result = announcementSchemas.updateTemplate.validate(validData);
            expect(result.error).toBeUndefined();
        });

        it('should allow null title to clear it', () => {
            const validData = {
                title: null
            };

            const result = announcementSchemas.updateTemplate.validate(validData);
            expect(result.error).toBeUndefined();
            expect(result.value.title).toBeNull();
        });

        it('should validate embed config updates', () => {
            const validData = {
                embedConfig: {
                    color: '#00FF00'
                }
            };

            const result = announcementSchemas.updateTemplate.validate(validData);
            expect(result.error).toBeUndefined();
        });
    });

    describe('queryTemplates schema', () => {
        it('should use default pagination values', () => {
            const validData = {};

            const result = announcementSchemas.queryTemplates.validate(validData);
            expect(result.error).toBeUndefined();
            expect(result.value.page).toBe(1);
            expect(result.value.limit).toBe(20);
        });

        it('should accept filter parameters', () => {
            const validData = {
                isGlobal: true,
                createdBy: 'user-123'
            };

            const result = announcementSchemas.queryTemplates.validate(validData);
            expect(result.error).toBeUndefined();
            expect(result.value.isGlobal).toBe(true);
        });
    });

    describe('createFromTemplate schema', () => {
        it('should require template ID', () => {
            const invalidData = {};

            const result = announcementSchemas.createFromTemplate.validate(invalidData);
            expect(result.error).toBeDefined();
            expect(result.error?.message).toContain('templateId');
        });

        it('should accept overrides', () => {
            const validData = {
                templateId: '550e8400-e29b-41d4-a716-446655440000',
                title: 'Custom Title',
                content: 'Custom Content'
            };

            const result = announcementSchemas.createFromTemplate.validate(validData);
            expect(result.error).toBeUndefined();
            expect(result.value.title).toBe('Custom Title');
        });
    });

    describe('globalBroadcast schema', () => {
        it('should require confirmation', () => {
            const invalidData = {
                channelName: 'announcements'
            };

            const result = announcementSchemas.globalBroadcast.validate(invalidData);
            expect(result.error).toBeDefined();
            expect(result.error?.message).toContain('confirmation');
        });

        it('should reject false confirmation', () => {
            const invalidData = {
                confirmation: false
            };

            const result = announcementSchemas.globalBroadcast.validate(invalidData);
            expect(result.error).toBeDefined();
        });

        it('should accept valid global broadcast request', () => {
            const validData = {
                confirmation: true,
                channelName: 'announcements'
            };

            const result = announcementSchemas.globalBroadcast.validate(validData);
            expect(result.error).toBeUndefined();
            expect(result.value.confirmation).toBe(true);
        });

        it('should use default channel name', () => {
            const validData = {
                confirmation: true
            };

            const result = announcementSchemas.globalBroadcast.validate(validData);
            expect(result.error).toBeUndefined();
            expect(result.value.channelName).toBe('announcements');
        });
    });

afterAll(() => {
  jest.restoreAllMocks();
});
});
