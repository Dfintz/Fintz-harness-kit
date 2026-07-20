import type { Theme } from '@mui/material/styles';

/**
 * Shared colour utilities for ship career, role, size, and manufacturer.
 * Used by FleetBreakdownPanel (chips) and PersonalHangar (charts).
 */

export const getCareerColor = (career: string, t: Theme): string => {
  const colors: Record<string, string> = {
    // Primary display categories
    combat: t.palette.error.main,
    gunship: t.palette.error.light,
    'capital crew': t.palette.error.dark,
    hauling: t.palette.secondary.main,
    mining: t.palette.warning.main,
    salvaging: t.palette.warning.light,
    industrial: t.palette.warning.main,
    exploration: t.palette.info.main,
    medical: t.palette.success.main,
    racing: t.palette.error.light,
    driving: t.palette.warning.dark,
    'multi-role': t.palette.success.light,
    multirole: t.palette.success.light,
    // Legacy raw career values (fallback for pre-mapped data)
    transport: t.palette.secondary.main,
    transporter: t.palette.secondary.main,
    support: t.palette.info.light,
    competition: t.palette.warning.light,
    ground: t.palette.warning.dark,
    'ground combat': t.palette.error.dark,
    unknown: t.palette.grey[500],
  };
  return colors[career.toLowerCase()] ?? t.palette.text.secondary;
};

export const getRoleColor = (role: string, t: Theme): string => {
  const colors: Record<string, string> = {
    command: t.palette.warning.light,
    combat: t.palette.error.main,
    logistics: t.palette.warning.main,
    mining: t.palette.warning.dark,
    exploration: t.palette.info.main,
    expedition: t.palette.info.dark,
    medical: t.palette.success.main,
    transport: t.palette.secondary.main,
    support: t.palette.info.light,
    racing: t.palette.error.light,
    bomber: t.palette.error.dark,
    gunship: t.palette.warning.dark,
    'heavy gunship': t.palette.warning.dark,
    'heavy fighter': t.palette.error.main,
    'medium fighter': t.palette.warning.light,
    'light fighter': t.palette.error.light,
    'snub fighter': t.palette.secondary.dark,
    interceptor: t.palette.secondary.main,
    interdiction: t.palette.secondary.light,
    'medium freight': t.palette.warning.main,
    'light mining': t.palette.success.dark,
    'light salvage': t.palette.success.light,
    'medium data': t.palette.info.dark,
    pathfinder: t.palette.info.light,
    recovery: t.palette.success.main,
    reserve: t.palette.grey[500],
    unassigned: t.palette.grey[400],
    unknown: t.palette.grey[500],
  };
  return colors[role.toLowerCase()] ?? t.palette.text.secondary;
};

export const getSizeColor = (size: string, t: Theme): string => {
  const colors: Record<string, string> = {
    vehicle: t.palette.grey[500],
    snub: t.palette.secondary.main,
    small: t.palette.info.light,
    medium: t.palette.info.main,
    large: t.palette.warning.main,
    sub_capital: t.palette.error.light,
    'sub capital': t.palette.error.light,
    capital: t.palette.error.main,
    unknown: t.palette.grey[500],
  };
  return colors[size.toLowerCase()] ?? t.palette.text.secondary;
};

export const getManufacturerColor = (mfr: string, t: Theme): string => {
  const colors: Record<string, string> = {
    'aegis dynamics': t.palette.error.main,
    aegis: t.palette.error.main,
    'roberts space industries': t.palette.info.main,
    rsi: t.palette.info.main,
    'drake interplanetary': t.palette.warning.main,
    drake: t.palette.warning.main,
    'origin jumpworks': t.palette.success.light,
    origin: t.palette.success.light,
    anvil: t.palette.warning.light,
    'anvil aerospace': t.palette.warning.light,
    crusader: t.palette.info.light,
    'crusader industries': t.palette.info.light,
    'consolidated outland': t.palette.secondary.main,
    misc: t.palette.success.main,
    'musashi industrial & starflight concern': t.palette.success.main,
    esperia: t.palette.error.light,
    'argo astronautics': t.palette.grey[400],
    argo: t.palette.grey[400],
    gatac: t.palette.secondary.light,
    'gatac manufacture': t.palette.secondary.light,
    'tumbril land systems': t.palette.warning.dark,
    tumbril: t.palette.warning.dark,
    greycat: t.palette.grey[500],
    'greycat industrial': t.palette.grey[500],
  };
  return colors[mfr.toLowerCase()] ?? t.palette.text.secondary;
};

export const getStatusColor = (status: string, t: Theme): string => {
  const colors: Record<string, string> = {
    owned: t.palette.success.main,
    pledged: t.palette.info.main,
    loaned: t.palette.warning.main,
    gifted: t.palette.success.light,
    lost: t.palette.error.main,
    destroyed: t.palette.error.dark,
    sold: t.palette.grey[500],
  };
  return colors[status.toLowerCase()] ?? t.palette.text.secondary;
};

export const getConditionColor = (condition: string, t: Theme): string => {
  const colors: Record<string, string> = {
    pristine: t.palette.success.light,
    excellent: t.palette.success.main,
    good: t.palette.success.dark,
    fair: t.palette.warning.light,
    poor: t.palette.warning.main,
    damaged: t.palette.error.light,
    critical: t.palette.error.main,
  };
  return colors[condition.toLowerCase()] ?? t.palette.text.secondary;
};

export const getSharingLevelColor = (level: string, t: Theme): string => {
  const colors: Record<string, string> = {
    private: t.palette.grey[500],
    personal: t.palette.grey[600],
    shared_users: t.palette.info.light,
    organization: t.palette.info.main,
    alliance: t.palette.warning.main,
    public: t.palette.success.main,
  };
  return colors[level.toLowerCase()] ?? t.palette.text.secondary;
};

/** Format a label key for display: "sub_capital" → "Sub Capital", "multi-role" → "Multi Role" */
export function formatShipLabel(key: string): string {
  return key.replaceAll(/[-_]/g, ' ').replaceAll(/\b\w/g, c => c.toUpperCase());
}
