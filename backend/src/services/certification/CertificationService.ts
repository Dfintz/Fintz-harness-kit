import { AppDataSource } from '../../config/database';
import { Certification } from '../../models/Certification';
import { CertificationStatus, UserCertification } from '../../models/UserCertification';
import { ConflictError, NotFoundError } from '../../utils/apiErrors';
import { AuditEventType, logAuditEvent } from '../../utils/auditLogger';

export class CertificationService {
  private readonly certRepository = AppDataSource.getRepository(Certification);
  private readonly userCertRepository = AppDataSource.getRepository(UserCertification);

  async listCertifications(
    organizationId: string,
    filters?: { status?: string; search?: string; limit?: number }
  ): Promise<Certification[]> {
    const qb = this.certRepository
      .createQueryBuilder('cert')
      .where('cert.organizationId = :organizationId', { organizationId })
      .orderBy('cert.name', 'ASC');

    if (filters?.search) {
      qb.andWhere('cert.name ILIKE :search', { search: `%${filters.search}%` });
    }
    qb.take(filters?.limit ?? 50);

    return qb.getMany();
  }

  async getCertification(organizationId: string, certId: string): Promise<Certification | null> {
    return this.certRepository.findOne({
      where: { id: certId, organizationId },
    });
  }

  async createCertification(
    organizationId: string,
    userId: string,
    data: { name: string; description?: string; requirements?: string }
  ): Promise<Certification> {
    const existing = await this.certRepository.findOne({
      where: { organizationId, name: data.name },
    });
    if (existing) {
      throw new ConflictError('A certification with this name already exists');
    }

    const cert = this.certRepository.create({
      ...data,
      organizationId,
      createdBy: userId,
    });
    return this.certRepository.save(cert);
  }

  async updateCertification(
    organizationId: string,
    certId: string,
    data: { name?: string; description?: string; requirements?: string }
  ): Promise<Certification> {
    const cert = await this.certRepository.findOne({
      where: { id: certId, organizationId },
    });
    if (!cert) {
      throw new NotFoundError('Certification');
    }

    if (data.name && data.name !== cert.name) {
      const duplicate = await this.certRepository.findOne({
        where: { organizationId, name: data.name },
      });
      if (duplicate) {
        throw new ConflictError('A certification with this name already exists');
      }
    }

    Object.assign(cert, data);
    return this.certRepository.save(cert);
  }

  async deleteCertification(organizationId: string, certId: string): Promise<void> {
    const cert = await this.certRepository.findOne({
      where: { id: certId, organizationId },
    });
    if (!cert) {
      throw new NotFoundError('Certification');
    }

    await this.userCertRepository.delete({ certificationId: certId });
    await this.certRepository.remove(cert);
  }

  async awardCertification(
    organizationId: string,
    awarderId: string,
    certId: string,
    userId: string
  ): Promise<UserCertification> {
    const cert = await this.certRepository.findOne({
      where: { id: certId, organizationId },
    });
    if (!cert) {
      throw new NotFoundError('Certification');
    }

    const existing = await this.userCertRepository.findOne({
      where: { organizationId, userId, certificationId: certId },
    });
    if (existing?.status === CertificationStatus.ACTIVE) {
      throw new ConflictError('User already holds this certification');
    }

    if (existing) {
      // Re-award a revoked certification
      existing.status = CertificationStatus.ACTIVE;
      existing.awardedBy = awarderId;
      existing.awardedAt = new Date();
      existing.revokedBy = undefined;
      existing.revokedAt = undefined;
      existing.revokeReason = undefined;
      return this.userCertRepository.save(existing);
    }

    const userCert = this.userCertRepository.create({
      organizationId,
      userId,
      certificationId: certId,
      awardedBy: awarderId,
      awardedAt: new Date(),
    });
    const saved = await this.userCertRepository.save(userCert);

    logAuditEvent({
      eventType: AuditEventType.ACTIVITY_ACTION,
      userId: awarderId,
      resource: 'certification',
      action: 'award',
      message: `Certification '${cert.name}' awarded to user ${userId} by ${awarderId} in org ${organizationId}`,
      metadata: {
        organizationId,
        certId,
        certName: cert.name,
        awardedTo: userId,
        awardedBy: awarderId,
      },
    });

    return saved;
  }

  async revokeCertification(
    organizationId: string,
    revokerId: string,
    certId: string,
    userId: string,
    reason: string
  ): Promise<UserCertification> {
    const userCert = await this.userCertRepository.findOne({
      where: {
        organizationId,
        userId,
        certificationId: certId,
        status: CertificationStatus.ACTIVE,
      },
    });
    if (!userCert) {
      throw new NotFoundError('Active certification for this user');
    }

    userCert.status = CertificationStatus.REVOKED;
    userCert.revokedBy = revokerId;
    userCert.revokedAt = new Date();
    userCert.revokeReason = reason;
    const saved = await this.userCertRepository.save(userCert);

    logAuditEvent({
      eventType: AuditEventType.ACTIVITY_ACTION,
      userId: revokerId,
      resource: 'certification',
      action: 'revoke',
      message: `Certification revoked for user ${userId} by ${revokerId} in org ${organizationId}: ${reason}`,
      metadata: { organizationId, certId, revokedFrom: userId, revokedBy: revokerId, reason },
    });

    return saved;
  }

  async getUserCertifications(
    organizationId: string,
    userId: string
  ): Promise<UserCertification[]> {
    return this.userCertRepository.find({
      where: { organizationId, userId },
      relations: ['certification'],
      order: { awardedAt: 'DESC' },
    });
  }

  async getCertificationHolders(
    organizationId: string,
    certId: string
  ): Promise<UserCertification[]> {
    return this.userCertRepository.find({
      where: {
        organizationId,
        certificationId: certId,
        status: CertificationStatus.ACTIVE,
      },
      order: { awardedAt: 'DESC' },
    });
  }
}
