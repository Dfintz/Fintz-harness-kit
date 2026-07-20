import { Certification } from '../../models/Certification';
import { UserCertification } from '../../models/UserCertification';
export declare class CertificationService {
    private readonly certRepository;
    private readonly userCertRepository;
    listCertifications(organizationId: string, filters?: {
        status?: string;
        search?: string;
        limit?: number;
    }): Promise<Certification[]>;
    getCertification(organizationId: string, certId: string): Promise<Certification | null>;
    createCertification(organizationId: string, userId: string, data: {
        name: string;
        description?: string;
        requirements?: string;
    }): Promise<Certification>;
    updateCertification(organizationId: string, certId: string, data: {
        name?: string;
        description?: string;
        requirements?: string;
    }): Promise<Certification>;
    deleteCertification(organizationId: string, certId: string): Promise<void>;
    awardCertification(organizationId: string, awarderId: string, certId: string, userId: string): Promise<UserCertification>;
    revokeCertification(organizationId: string, revokerId: string, certId: string, userId: string, reason: string): Promise<UserCertification>;
    getUserCertifications(organizationId: string, userId: string): Promise<UserCertification[]>;
    getCertificationHolders(organizationId: string, certId: string): Promise<UserCertification[]>;
}
//# sourceMappingURL=CertificationService.d.ts.map