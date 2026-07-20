/**
 * MUI Icon mappings for activity types, statuses, and crew roles.
 *
 * Replaces emoji characters with proper MUI icons for consistent UI rendering.
 * The emoji field in shared-types activityDisplay.ts is preserved for Discord bot usage.
 */
import AdjustIcon from '@mui/icons-material/Adjust';
import AssignmentIcon from '@mui/icons-material/Assignment';
import AssignmentLateIcon from '@mui/icons-material/AssignmentLate';
import BlockIcon from '@mui/icons-material/Block';
import BuildIcon from '@mui/icons-material/Build';
import CampaignIcon from '@mui/icons-material/Campaign';
import CancelIcon from '@mui/icons-material/Cancel';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import SkullIcon from '@mui/icons-material/Dangerous';
import DescriptionIcon from '@mui/icons-material/Description';
import EditNoteIcon from '@mui/icons-material/EditNote';
import EventIcon from '@mui/icons-material/Event';
import ExploreIcon from '@mui/icons-material/Explore';
import GpsFixedIcon from '@mui/icons-material/GpsFixed';
import LocalHospitalIcon from '@mui/icons-material/LocalHospital';
import PersonIcon from '@mui/icons-material/Person';
import PinDropIcon from '@mui/icons-material/PinDrop';
import RocketLaunchIcon from '@mui/icons-material/RocketLaunch';
import SearchIcon from '@mui/icons-material/Search';
import ShieldIcon from '@mui/icons-material/Shield';
import SwordsIcon from '@mui/icons-material/Sports';
import SportsScoreIcon from '@mui/icons-material/SportsScore';
import StarIcon from '@mui/icons-material/Star';
import TimerOffIcon from '@mui/icons-material/TimerOff';
import WorkIcon from '@mui/icons-material/Work';
import type { SvgIconProps } from '@mui/material/SvgIcon';
import React from 'react';

// ---------------------------------------------------------------------------
// Activity Type Icons
// ---------------------------------------------------------------------------

const ACTIVITY_TYPE_ICONS: Record<string, React.ComponentType<SvgIconProps>> = {
  mission: GpsFixedIcon,
  contract: AssignmentIcon,
  bounty: SkullIcon,
  event: EventIcon,
  lfg: SearchIcon,
  operation: SwordsIcon,
  job_listing: WorkIcon,
};

const DEFAULT_TYPE_ICON = PinDropIcon;

export function getActivityTypeIcon(type?: string): React.ComponentType<SvgIconProps> {
  if (!type) return DEFAULT_TYPE_ICON;
  return ACTIVITY_TYPE_ICONS[type.toLowerCase()] ?? DEFAULT_TYPE_ICON;
}

// ---------------------------------------------------------------------------
// Activity Status Icons
// ---------------------------------------------------------------------------

const ACTIVITY_STATUS_ICONS: Record<string, React.ComponentType<SvgIconProps>> = {
  draft: EditNoteIcon,
  open: AdjustIcon,
  planning: DescriptionIcon,
  recruiting: CampaignIcon,
  ready: CheckCircleIcon,
  in_progress: RocketLaunchIcon,
  completed: SportsScoreIcon,
  failed: CancelIcon,
  cancelled: BlockIcon,
  expired: TimerOffIcon,
};

const DEFAULT_STATUS_ICON = AdjustIcon;

export function getActivityStatusIcon(status?: string): React.ComponentType<SvgIconProps> {
  if (!status) return DEFAULT_STATUS_ICON;
  return ACTIVITY_STATUS_ICONS[status.toLowerCase()] ?? DEFAULT_STATUS_ICON;
}

// ---------------------------------------------------------------------------
// Crew/Ship Role Icons
// ---------------------------------------------------------------------------

const ROLE_ICONS: Record<string, React.ComponentType<SvgIconProps>> = {
  pilot: GpsFixedIcon,
  copilot: GpsFixedIcon,
  gunner: ExploreIcon,
  engineer: BuildIcon,
  crew: PersonIcon,
  medic: LocalHospitalIcon,
  marine: ShieldIcon,
};

const DEFAULT_ROLE_ICON = PersonIcon;

export function getRoleIcon(role: string): React.ComponentType<SvgIconProps> {
  return ROLE_ICONS[role.toLowerCase()] ?? DEFAULT_ROLE_ICON;
}

// ---------------------------------------------------------------------------
// Inline icon renderer — convenience for use in Chip labels + Typography
// ---------------------------------------------------------------------------

export function renderActivityTypeIcon(type?: string, props?: SvgIconProps): React.ReactElement {
  const Icon = getActivityTypeIcon(type);
  return <Icon fontSize="inherit" {...props} />;
}

export function renderActivityStatusIcon(
  status?: string,
  props?: SvgIconProps
): React.ReactElement {
  const Icon = getActivityStatusIcon(status);
  return <Icon fontSize="inherit" {...props} />;
}

export function renderRoleIcon(role: string, props?: SvgIconProps): React.ReactElement {
  const Icon = getRoleIcon(role);
  return <Icon fontSize="inherit" {...props} />;
}

// ---------------------------------------------------------------------------
// Bounty / Hunter Icons
// ---------------------------------------------------------------------------

export const BountyTypeIcons: Record<string, React.ComponentType<SvgIconProps>> = {
  intel: SearchIcon,
  transport: AssignmentIcon,
  custom: StarIcon,
  unknown: GpsFixedIcon,
};

export const BountyStatusIcons: Record<string, React.ComponentType<SvgIconProps>> = {
  approved: CheckCircleOutlineIcon,
  submitted: AssignmentLateIcon,
  failed: CancelIcon,
  rejected: CancelIcon,
  completed: CheckCircleIcon,
};

export const HunterTierIcons: Record<string, React.ComponentType<SvgIconProps>> = {
  legendary: StarIcon,
  elite: StarIcon,
  veteran: StarIcon,
  rookie: GpsFixedIcon,
};
