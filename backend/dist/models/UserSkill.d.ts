import { Skill } from './Skill';
import { SkillEndorsement } from './SkillEndorsement';
export declare enum SkillLevel {
    BEGINNER = "beginner",
    INTERMEDIATE = "intermediate",
    ADVANCED = "advanced",
    EXPERT = "expert"
}
export declare class UserSkill {
    id: string;
    organizationId: string;
    userId: string;
    skillId: string;
    skill?: Skill;
    level: SkillLevel;
    endorsementCount: number;
    endorsements?: SkillEndorsement[];
    createdAt: Date;
    updatedAt: Date;
}
//# sourceMappingURL=UserSkill.d.ts.map