import Joi from 'joi';

const focusValues = [
  'Bounty Hunting',
  'Engineering',
  'Exploration',
  'Medical',
  'Piracy',
  'Infiltration',
  'Resources',
  'Scouting',
  'Security',
  'Smuggling',
  'Trading',
  'Transport',
];

export const setUserFocusSchema = Joi.object({
  primaryFocuses: Joi.array()
    .items(Joi.string().valid(...focusValues))
    .max(3)
    .required(),
  secondaryFocuses: Joi.array()
    .items(Joi.string().valid(...focusValues))
    .max(3)
    .required(),
});

export const setOrgFocusSchema = Joi.object({
  focuses: Joi.array()
    .items(Joi.string().valid(...focusValues))
    .max(2)
    .required(),
});
