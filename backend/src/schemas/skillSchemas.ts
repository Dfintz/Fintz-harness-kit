import Joi from 'joi';

const skillCategories = [
  'combat',
  'mining',
  'trading',
  'exploration',
  'medical',
  'engineering',
  'piloting',
  'leadership',
  'logistics',
  'other',
];

const skillLevels = ['beginner', 'intermediate', 'advanced', 'expert'];

export const skillSchemas = {
  create: Joi.object({
    name: Joi.string().trim().min(1).max(100).required(),
    description: Joi.string().trim().max(1000).optional(),
    category: Joi.string()
      .valid(...skillCategories)
      .default('other'),
  }),

  update: Joi.object({
    name: Joi.string().trim().min(1).max(100).optional(),
    description: Joi.string().trim().max(1000).allow('').optional(),
    category: Joi.string()
      .valid(...skillCategories)
      .optional(),
  }).min(1),

  assignSkill: Joi.object({
    userId: Joi.string().uuid().required(),
    level: Joi.string()
      .valid(...skillLevels)
      .default('beginner'),
  }),

  endorse: Joi.object({
    userId: Joi.string().uuid().required(),
  }),

  query: Joi.object({
    category: Joi.string()
      .valid(...skillCategories)
      .optional(),
    search: Joi.string().trim().max(200).optional(),
    limit: Joi.number().integer().min(1).max(100).default(50),
  }),

  param: Joi.object({
    skillId: Joi.string().uuid().required(),
  }),
};
