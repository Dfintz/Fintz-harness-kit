import { Request, Response } from 'express';

import { AppDataSource } from '../../config/database';
import { ApiError } from '../../middleware/errorHandlerV2';
import { buildHateoasLinks } from '../../middleware/queryParser';
import { Organization } from '../../models/Organization';
import { OrganizationService } from '../../services/organization/OrganizationService';
import { orgTierService } from '../../services/organization/OrgTierService';
import { ApiErrorCode } from '../../types/api';
import { getErrorMessage } from '../../utils/errorHandler';

export async function listOrganizationsCoreHandler(req: Request, res: Response): Promise<void> {
  const queryParams = req.queryParams ?? { limit: 20, offset: 0, sort: null };
  const { limit, offset, sort } = queryParams;

  const orgRepo = AppDataSource.getRepository(Organization);
  const queryBuilder = orgRepo.createQueryBuilder('organization');

  if (sort) {
    queryBuilder.orderBy(`organization.${sort.field}`, sort.order);
  } else {
    queryBuilder.orderBy('organization.createdAt', 'DESC');
  }

  const total = await queryBuilder.getCount();
  const organizations = await queryBuilder.skip(offset).take(limit).getMany();
  const links = buildHateoasLinks('/api/v2/organizations', offset, limit, total);

  res.paginated(
    organizations,
    {
      total,
      limit,
      offset,
      hasMore: offset + limit < total,
    },
    links
  );
}

export async function getOrganizationCoreHandler(req: Request, res: Response): Promise<void> {
  const { id } = req.params;

  const orgRepo = AppDataSource.getRepository(Organization);
  const organization = await orgRepo
    .createQueryBuilder('organization')
    .where('organization.id = :id', { id })
    .getOne();

  if (!organization) {
    throw new ApiError(ApiErrorCode.ORG_NOT_FOUND, 'Organization not found', 404);
  }

  res.success({
    ...organization,
    scale: orgTierService.getScalingProfile(organization.totalMembers),
  });
}

export async function createOrganizationCoreHandler(
  req: Request,
  res: Response,
  organizationService: OrganizationService
): Promise<void> {
  const userId = (req as { user?: { id?: string } }).user?.id;
  if (!userId) {
    throw new ApiError(ApiErrorCode.UNAUTHORIZED, 'Authentication required', 401);
  }

  const orgData = req.body as Partial<Organization>;

  try {
    const organization = await organizationService.createOrganization(orgData, userId);

    res.status(201);
    res.success(organization);
  } catch (error: unknown) {
    throw new ApiError(
      ApiErrorCode.INTERNAL_ERROR,
      getErrorMessage(error, 'Failed to create organization'),
      500
    );
  }
}

export async function updateOrganizationCoreHandler(
  req: Request,
  res: Response,
  organizationService: OrganizationService
): Promise<void> {
  const { id } = req.params;
  const userId = (req as { user?: { id?: string } }).user?.id;

  if (!userId) {
    throw new ApiError(ApiErrorCode.UNAUTHORIZED, 'Authentication required', 401);
  }

  const updates = req.body as Partial<Organization>;

  try {
    const organization = await organizationService.updateOrganization(id, updates, userId);

    if (!organization) {
      throw new ApiError(ApiErrorCode.ORG_NOT_FOUND, 'Organization not found', 404);
    }

    res.success(organization);
  } catch (error: unknown) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(
      ApiErrorCode.INTERNAL_ERROR,
      getErrorMessage(error, 'Failed to update organization'),
      500
    );
  }
}

export async function deleteOrganizationCoreHandler(
  req: Request,
  res: Response,
  organizationService: OrganizationService
): Promise<void> {
  const { id } = req.params;
  const userId = (req as { user?: { id?: string }; ip?: string }).user?.id;

  if (!userId) {
    throw new ApiError(ApiErrorCode.UNAUTHORIZED, 'Authentication required', 401);
  }

  try {
    const result = await organizationService.deleteOrganization(id, userId, false, {
      reason: 'User requested deletion',
      ipAddress: (req as { ip?: string }).ip,
      userAgent: req.get('user-agent'),
    });

    res.success({
      message: result.message,
      requestId: result.requestId,
      scheduledFor: result.scheduledFor,
    });
  } catch (error: unknown) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(
      ApiErrorCode.INTERNAL_ERROR,
      getErrorMessage(error, 'Failed to delete organization'),
      500
    );
  }
}
