import {
  AccountBalance,
  Assignment,
  AttachMoney,
  AutoAwesome,
  Build,
  Construction,
  DirectionsCar,
  Explore,
  GpsFixed,
  Grade,
  Handshake,
  LocalHospital,
  LocalShipping,
  Person,
  Shield,
  Star,
  TrackChanges,
  Visibility,
  Warning,
} from '@mui/icons-material';
import React from 'react';

import type { FederationRole, OrgPrimaryFocus } from '@/services/publicDirectoryService';

export function getFocusIcon(focus: OrgPrimaryFocus): React.ReactNode {
  const icons: Record<OrgPrimaryFocus, React.ReactNode> = {
    combat: <GpsFixed fontSize="small" />,
    mining: <Construction fontSize="small" />,
    trading: <AttachMoney fontSize="small" />,
    exploration: <Explore fontSize="small" />,
    bounty_hunting: <TrackChanges fontSize="small" />,
    medical: <LocalHospital fontSize="small" />,
    transport: <LocalShipping fontSize="small" />,
    salvage: <Build fontSize="small" />,
    security: <Shield fontSize="small" />,
    social: <Handshake fontSize="small" />,
    piracy: <Warning fontSize="small" />,
    racing: <DirectionsCar fontSize="small" />,
    mixed: <AutoAwesome fontSize="small" />,
  };

  return icons[focus] || <Assignment fontSize="small" />;
}

export function getFederationRoleIcon(role: FederationRole): React.ReactNode {
  const icons: Record<FederationRole, React.ReactNode> = {
    founder: <Star fontSize="small" />,
    leader: <Grade fontSize="small" />,
    council: <AccountBalance fontSize="small" />,
    member: <Handshake fontSize="small" />,
    observer: <Visibility fontSize="small" />,
  };

  return icons[role] || <Person fontSize="small" />;
}
