import { TreatyTemplate } from '../../../models/TreatyTemplate';
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '../../../utils/apiErrors';

const mockRepository = {
  find: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  remove: jest.fn(),
  createQueryBuilder: jest.fn(),
};

jest.mock('../../../data-source', () => ({
  AppDataSource: {
    getRepository: jest.fn().mockReturnValue(mockRepository),
  },
}));

import { TreatyTemplateService } from '../../../services/organization/TreatyTemplateService';

describe('TreatyTemplateService', () => {
  let service: TreatyTemplateService;
  const orgId = 'org-123';

  const mockTemplate: Partial<TreatyTemplate> = {
    id: 'template-1',
    name: 'Trade Agreement',
    description: 'A standard trade agreement template',
    category: 'trade',
    scope: 'both',
    clauses: [
      {
        id: 'clause-1',
        title: 'Pricing',
        text: 'Signatories agree to preferential pricing.',
        isRequired: true,
        sortOrder: 1,
      },
      {
        id: 'clause-2',
        title: 'Duration',
        text: 'Valid for 90 days.',
        isRequired: false,
        sortOrder: 2,
      },
    ],
    isBuiltIn: false,
    organizationId: orgId,
    isPublished: true,
    version: 1,
    tags: ['trade', 'commerce'],
  };

  const builtInTemplate: Partial<TreatyTemplate> = {
    ...mockTemplate,
    id: 'builtin-trade',
    name: 'Built-In Trade',
    isBuiltIn: true,
    organizationId: undefined,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new TreatyTemplateService();
  });

  describe('getTemplateById', () => {
    it('should return template when found', async () => {
      mockRepository.findOne.mockResolvedValue(mockTemplate);

      const result = await service.getTemplateById(orgId, 'template-1');

      expect(result).toEqual(mockTemplate);
    });

    it('should throw NotFoundError when template not found', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      await expect(service.getTemplateById(orgId, 'missing')).rejects.toThrow(NotFoundError);
    });
  });

  describe('createTemplate', () => {
    it('should create a new custom template', async () => {
      mockRepository.findOne.mockResolvedValue(null); // No duplicate
      mockRepository.create.mockReturnValue({ ...mockTemplate });
      mockRepository.save.mockResolvedValue({ ...mockTemplate });

      const result = await service.createTemplate(orgId, {
        name: 'Trade Agreement',
        description: 'A standard trade agreement template',
        category: 'trade',
        scope: 'both',
        clauses: [
          {
            title: 'Pricing',
            text: 'Signatories agree to preferential pricing.',
            isRequired: true,
            sortOrder: 1,
          },
        ],
        tags: ['trade'],
      });

      expect(mockRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Trade Agreement',
          isBuiltIn: false,
          organizationId: orgId,
        })
      );
      expect(result).toBeDefined();
    });

    it('should reject duplicate template names', async () => {
      mockRepository.findOne.mockResolvedValue(mockTemplate); // Duplicate found

      await expect(
        service.createTemplate(orgId, {
          name: 'Trade Agreement',
          description: 'Duplicate',
          category: 'trade',
          scope: 'both',
          clauses: [{ title: 'Test', text: 'Test clause text.', isRequired: false, sortOrder: 1 }],
        })
      ).rejects.toThrow(ConflictError);
    });
  });

  describe('updateTemplate', () => {
    it('should update a custom template', async () => {
      mockRepository.findOne
        .mockResolvedValueOnce({ ...mockTemplate }) // Find by id+orgId
        .mockResolvedValueOnce(null); // No duplicate name
      mockRepository.save.mockImplementation((t: unknown) => Promise.resolve(t));

      const result = await service.updateTemplate(orgId, 'template-1', {
        name: 'Updated Trade Agreement',
      });

      expect(result.name).toBe('Updated Trade Agreement');
    });

    it('should reject updating built-in templates', async () => {
      mockRepository.findOne.mockResolvedValue(builtInTemplate);

      await expect(
        service.updateTemplate(orgId, 'builtin-trade', { name: 'Hacked' })
      ).rejects.toThrow(ForbiddenError);
    });

    it('should throw NotFoundError for non-existent template', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      await expect(service.updateTemplate(orgId, 'missing', { name: 'Test' })).rejects.toThrow(
        NotFoundError
      );
    });

    it('should increment version when clauses are updated', async () => {
      const template = { ...mockTemplate, version: 1 };
      mockRepository.findOne.mockResolvedValue(template);
      mockRepository.save.mockImplementation((t: unknown) => Promise.resolve(t));

      const result = await service.updateTemplate(orgId, 'template-1', {
        clauses: [
          { title: 'New Clause', text: 'New clause text.', isRequired: true, sortOrder: 1 },
        ],
      });

      expect(result.version).toBe(2);
    });
  });

  describe('deleteTemplate', () => {
    it('should delete a custom template', async () => {
      mockRepository.findOne.mockResolvedValue(mockTemplate);
      mockRepository.remove.mockResolvedValue(mockTemplate);

      await service.deleteTemplate(orgId, 'template-1');

      expect(mockRepository.remove).toHaveBeenCalledWith(mockTemplate);
    });

    it('should reject deleting built-in templates', async () => {
      mockRepository.findOne.mockResolvedValue(builtInTemplate);

      await expect(service.deleteTemplate(orgId, 'builtin-trade')).rejects.toThrow(ForbiddenError);
    });

    it('should throw NotFoundError for non-existent template', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      await expect(service.deleteTemplate(orgId, 'missing')).rejects.toThrow(NotFoundError);
    });
  });

  describe('instantiateTemplate', () => {
    it('should generate terms from a template', async () => {
      mockRepository.findOne.mockResolvedValue(mockTemplate);

      const result = await service.instantiateTemplate(orgId, {
        templateId: 'template-1',
      });

      expect(result).toHaveLength(2);
      expect(result[0].term).toBe('Pricing');
      expect(result[0].description).toBe('Signatories agree to preferential pricing.');
    });

    it('should apply clause overrides', async () => {
      mockRepository.findOne.mockResolvedValue(mockTemplate);

      const result = await service.instantiateTemplate(orgId, {
        templateId: 'template-1',
        clauseOverrides: { Pricing: 'Custom pricing terms here.' },
      });

      expect(result[0].description).toBe('Custom pricing terms here.');
    });

    it('should exclude optional clauses', async () => {
      mockRepository.findOne.mockResolvedValue(mockTemplate);

      const result = await service.instantiateTemplate(orgId, {
        templateId: 'template-1',
        excludeClauses: ['Duration'],
      });

      expect(result).toHaveLength(1);
      expect(result[0].term).toBe('Pricing');
    });

    it('should reject excluding required clauses', async () => {
      mockRepository.findOne.mockResolvedValue(mockTemplate);

      await expect(
        service.instantiateTemplate(orgId, {
          templateId: 'template-1',
          excludeClauses: ['Pricing'],
        })
      ).rejects.toThrow(ValidationError);
    });

    it('should add additional custom clauses', async () => {
      mockRepository.findOne.mockResolvedValue(mockTemplate);

      const result = await service.instantiateTemplate(orgId, {
        templateId: 'template-1',
        additionalClauses: [{ title: 'Custom Term', text: 'A custom term added by the org.' }],
      });

      expect(result).toHaveLength(3);
      expect(result[2].term).toBe('Custom Term');
    });
  });
});
