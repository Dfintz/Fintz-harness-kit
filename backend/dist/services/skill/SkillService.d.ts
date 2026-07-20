import { Skill } from '../../models/Skill';
import { SkillEndorsement } from '../../models/SkillEndorsement';
import { UserSkill } from '../../models/UserSkill';
export declare class SkillService {
    private readonly skillRepository;
    private readonly userSkillRepository;
    private readonly endorsementRepository;
    listSkills(organizationId: string, filters?: {
        category?: string;
        search?: string;
        limit?: number;
    }): Promise<Skill[]>;
    getSkill(organizationId: string, skillId: string): Promise<Skill | null>;
    createSkill(organizationId: string, userId: string, data: {
        name: string;
        description?: string;
        category?: string;
    }): Promise<Skill>;
    updateSkill(organizationId: string, skillId: string, data: {
        name?: string;
        description?: string;
        category?: string;
    }): Promise<Skill>;
    deleteSkill(organizationId: string, skillId: string): Promise<void>;
    getUserSkills(organizationId: string, userId: string): Promise<UserSkill[]>;
    endorseSkill(organizationId: string, endorserId: string, skillId: string, userId: string): Promise<SkillEndorsement>;
    getCategories(): Promise<string[]>;
}
//# sourceMappingURL=SkillService.d.ts.map