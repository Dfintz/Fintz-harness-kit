import { TenantEntity } from './base/TenantEntity';
import { UserSkill } from './UserSkill';
export declare enum SkillCategory {
    COMBAT = "combat",
    MINING = "mining",
    TRADING = "trading",
    EXPLORATION = "exploration",
    MEDICAL = "medical",
    ENGINEERING = "engineering",
    PILOTING = "piloting",
    LEADERSHIP = "leadership",
    LOGISTICS = "logistics",
    OTHER = "other"
}
export declare class Skill extends TenantEntity {
    id: string;
    name: string;
    description?: string;
    category: SkillCategory;
    createdBy: string;
    userSkills?: UserSkill[];
    createdAt: Date;
    updatedAt: Date;
}
//# sourceMappingURL=Skill.d.ts.map