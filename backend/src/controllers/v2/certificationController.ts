import { Response } from 'express';

import { AuthRequest } from '../../middleware/auth';
import { CertificationService } from '../../services/certification/CertificationService';
import { ValidationError } from '../../utils/apiErrors';
import { BaseController } from '../BaseController';

/** Validated request body shapes (Joi-validated before controller entry) */
interface CreateCertificationBody {
  name: string;
  description?: string;
  requirements?: string;
}
interface UpdateCertificationBody {
  name?: string;
  description?: string;
  requirements?: string;
}
interface AwardCertificationBody {
  userId: string;
}
interface RevokeCertificationBody {
  userId: string;
  reason: string;
}

export class CertificationController extends BaseController {
  private readonly certificationService: CertificationService;

  constructor() {
    super();
    this.certificationService = new CertificationService();
  }

  listCertifications = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const organizationId = req.user?.currentOrganizationId;
      if (!organizationId) {
        throw new ValidationError('Organization context required');
      }

      const { limit, search } = req.query;
      const data = await this.certificationService.listCertifications(organizationId, {
        limit: limit ? Math.min(parseInt(limit as string, 10), 200) : undefined,
        search: search as string,
      });

      res.json({ success: true, data });
    });
  };

  getCertification = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const organizationId = req.user?.currentOrganizationId;
      if (!organizationId) {
        throw new ValidationError('Organization context required');
      }

      const cert = await this.certificationService.getCertification(
        organizationId,
        req.params.certificationId
      );
      if (!cert) {
        res.status(404).json({ success: false, error: 'Certification not found' });
        return;
      }
      res.json({ success: true, data: cert });
    });
  };

  createCertification = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const organizationId = req.user?.currentOrganizationId;
      const userId = req.user?.id;
      if (!organizationId || !userId) {
        throw new ValidationError('Organization context required');
      }

      const body = req.body as CreateCertificationBody;
      const cert = await this.certificationService.createCertification(
        organizationId,
        userId,
        body
      );
      res.status(201).json({ success: true, data: cert });
    });
  };

  updateCertification = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const organizationId = req.user?.currentOrganizationId;
      if (!organizationId) {
        throw new ValidationError('Organization context required');
      }

      const body = req.body as UpdateCertificationBody;
      const cert = await this.certificationService.updateCertification(
        organizationId,
        req.params.certificationId,
        body
      );
      res.json({ success: true, data: cert });
    });
  };

  deleteCertification = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const organizationId = req.user?.currentOrganizationId;
      if (!organizationId) {
        throw new ValidationError('Organization context required');
      }

      await this.certificationService.deleteCertification(
        organizationId,
        req.params.certificationId
      );
      res.json({ success: true, message: 'Certification deleted' });
    });
  };

  awardCertification = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const organizationId = req.user?.currentOrganizationId;
      const userId = req.user?.id;
      if (!organizationId || !userId) {
        throw new ValidationError('Organization context required');
      }
      const { userId: targetUserId } = req.body as AwardCertificationBody;
      const userCert = await this.certificationService.awardCertification(
        organizationId,
        userId,
        req.params.certificationId,
        targetUserId
      );
      res.status(201).json({ success: true, data: userCert });
    });
  };

  revokeCertification = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const organizationId = req.user?.currentOrganizationId;
      const userId = req.user?.id;
      if (!organizationId || !userId) {
        throw new ValidationError('Organization context required');
      }
      const { userId: targetUserId, reason } = req.body as RevokeCertificationBody;
      const userCert = await this.certificationService.revokeCertification(
        organizationId,
        userId,
        req.params.certificationId,
        targetUserId,
        reason
      );
      res.json({ success: true, data: userCert });
    });
  };

  getUserCertifications = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const organizationId = req.user?.currentOrganizationId;
      if (!organizationId) {
        throw new ValidationError('Organization context required');
      }

      const certs = await this.certificationService.getUserCertifications(
        organizationId,
        req.params.userId
      );
      res.json({ success: true, data: certs });
    });
  };

  getCertificationHolders = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const organizationId = req.user?.currentOrganizationId;
      if (!organizationId) {
        throw new ValidationError('Organization context required');
      }

      const holders = await this.certificationService.getCertificationHolders(
        organizationId,
        req.params.certificationId
      );
      res.json({ success: true, data: holders });
    });
  };
}
