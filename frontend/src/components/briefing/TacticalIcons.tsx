import { Box, Tooltip, useTheme } from '@mui/material';
import { type SxProps, type Theme } from '@mui/material/styles';
import React from 'react';

// ============================================================================
// Tactical Unit Types
// ============================================================================

export type TacticalUnitType =
  | 'fighter'
  | 'bomber'
  | 'scout'
  | 'transport'
  | 'capital'
  | 'support'
  | 'mining'
  | 'salvage';

export type FormationSize =
  | 'element' // 2 ships
  | 'flight' // 4 ships
  | 'platoon' // 8-12 ships
  | 'squadron' // 16-24 ships
  | 'fleet'; // 24+ ships / capital group

export interface TacticalIconProps {
  readonly unitType: TacticalUnitType;
  readonly size?: FormationSize;
  readonly color?: string;
  readonly width?: number;
  readonly height?: number;
  readonly label?: string;
  readonly selected?: boolean;
  readonly onClick?: () => void;
  readonly sx?: SxProps<Theme>;
}

// ============================================================================
// Size Indicator (NATO-style echelon marks above the frame)
// ============================================================================

const getSizeIndicator = (size: FormationSize): string => {
  switch (size) {
    case 'element':
      return '•'; // 2 ships
    case 'flight':
      return '••'; // 4 ships
    case 'platoon':
      return '•••'; // 8-12 ships
    case 'squadron':
      return 'II'; // 16-24 ships
    case 'fleet':
      return 'III'; // 24+ ships
    default:
      return '';
  }
};

const getSizeLabel = (size: FormationSize): string => {
  switch (size) {
    case 'element':
      return 'Element (2 ships)';
    case 'flight':
      return 'Flight (4 ships)';
    case 'platoon':
      return 'Platoon (8-12 ships)';
    case 'squadron':
      return 'Squadron (16-24 ships)';
    case 'fleet':
      return 'Fleet (24+ ships)';
    default:
      return '';
  }
};

// ============================================================================
// Unit Type SVG Symbols (Star Citizen-inspired ship silhouettes — top-down)
// ============================================================================

const getUnitSymbolPath = (unitType: TacticalUnitType): React.ReactNode => {
  // All paths drawn in 0-32 viewBox, centered at 16,17. Top = nose, bottom = engines.
  switch (unitType) {
    // Fighter: swept-wing interceptor (Gladius / Arrow style)
    case 'fighter':
      return (
        <>
          {/* Fuselage */}
          <path
            d="M16,6 L17.5,10 L17,14 L18,16 L17,22 L17.5,26 L16,28 L14.5,26 L15,22 L14,16 L15,14 L14.5,10 Z"
            strokeWidth="1.2"
            fill="currentColor"
            fillOpacity={0.25}
          />
          {/* Swept wings */}
          <path
            d="M15,14 L6,20 L7,22 L14,18"
            strokeWidth="1"
            fill="currentColor"
            fillOpacity={0.15}
          />
          <path
            d="M17,14 L26,20 L25,22 L18,18"
            strokeWidth="1"
            fill="currentColor"
            fillOpacity={0.15}
          />
          {/* Engine glow */}
          <line x1="15" y1="27" x2="15" y2="29" strokeWidth="1.5" opacity="0.6" />
          <line x1="17" y1="27" x2="17" y2="29" strokeWidth="1.5" opacity="0.6" />
        </>
      );
    // Bomber: flying-wing stealth (Eclipse / Retaliator style)
    case 'bomber':
      return (
        <>
          {/* Wide flying wing body */}
          <path
            d="M16,7 L18,10 L26,18 L26,21 L22,22 L19,20 L18,24 L16,25 L14,24 L13,20 L10,22 L6,21 L6,18 L14,10 Z"
            strokeWidth="1.2"
            fill="currentColor"
            fillOpacity={0.25}
          />
          {/* Torpedo bays (two dash lines under wing) */}
          <line x1="11" y1="17" x2="13" y2="17" strokeWidth="1" opacity="0.5" />
          <line x1="19" y1="17" x2="21" y2="17" strokeWidth="1" opacity="0.5" />
          {/* Engine glow */}
          <line x1="14.5" y1="24" x2="14.5" y2="26" strokeWidth="1.5" opacity="0.5" />
          <line x1="17.5" y1="24" x2="17.5" y2="26" strokeWidth="1.5" opacity="0.5" />
        </>
      );
    // Scout: compact sensor ship (Herald / Terrapin style)
    case 'scout':
      return (
        <>
          {/* Compact hull */}
          <path
            d="M16,8 L18,12 L20,14 L21,18 L20,22 L18,24 L16,25 L14,24 L12,22 L11,18 L12,14 L14,12 Z"
            strokeWidth="1.2"
            fill="currentColor"
            fillOpacity={0.25}
          />
          {/* Sensor array (dish on nose) */}
          <circle cx="16" cy="9" r="2" strokeWidth="1" fill="currentColor" fillOpacity={0.15} />
          <circle cx="16" cy="9" r="0.8" fill="currentColor" fillOpacity={0.5} stroke="none" />
          {/* Stubby sensor wings */}
          <line x1="12" y1="16" x2="8" y2="18" strokeWidth="1.2" />
          <line x1="20" y1="16" x2="24" y2="18" strokeWidth="1.2" />
          {/* Engine pods */}
          <rect
            x="13"
            y="24"
            width="2"
            height="3"
            rx="0.5"
            fill="currentColor"
            fillOpacity={0.2}
            strokeWidth="0.8"
          />
          <rect
            x="17"
            y="24"
            width="2"
            height="3"
            rx="0.5"
            fill="currentColor"
            fillOpacity={0.2}
            strokeWidth="0.8"
          />
        </>
      );
    // Transport: heavy cargo lifter (Hercules / Caterpillar style)
    case 'transport':
      return (
        <>
          {/* Wide fuselage with cargo bay */}
          <path
            d="M16,7 L19,9 L20,8 L21,10 L22,16 L22,22 L20,26 L16,27 L12,26 L10,22 L10,16 L11,10 L12,8 L13,9 Z"
            strokeWidth="1.2"
            fill="currentColor"
            fillOpacity={0.25}
          />
          {/* Cargo bay lines */}
          <line x1="12" y1="14" x2="20" y2="14" strokeWidth="0.7" opacity="0.4" />
          <line x1="12" y1="18" x2="20" y2="18" strokeWidth="0.7" opacity="0.4" />
          <line x1="11" y1="22" x2="21" y2="22" strokeWidth="0.7" opacity="0.4" />
          {/* Wing engines */}
          <path
            d="M10,14 L7,16 L7,20 L10,20"
            strokeWidth="1"
            fill="currentColor"
            fillOpacity={0.1}
          />
          <path
            d="M22,14 L25,16 L25,20 L22,20"
            strokeWidth="1"
            fill="currentColor"
            fillOpacity={0.1}
          />
          {/* Engine glow */}
          <line x1="7" y1="20" x2="7" y2="22" strokeWidth="1.5" opacity="0.5" />
          <line x1="25" y1="20" x2="25" y2="22" strokeWidth="1.5" opacity="0.5" />
        </>
      );
    // Capital Ship: massive carrier/destroyer (Javelin / Idris style)
    case 'capital':
      return (
        <>
          {/* Main hull — long angular wedge */}
          <path
            d="M16,5 L18,8 L20,7 L21,10 L23,12 L25,16 L25,22 L23,26 L20,28 L16,29 L12,28 L9,26 L7,22 L7,16 L9,12 L11,10 L12,7 L14,8 Z"
            strokeWidth="1.2"
            fill="currentColor"
            fillOpacity={0.25}
          />
          {/* Bridge/command deck */}
          <rect
            x="14"
            y="9"
            width="4"
            height="3"
            rx="1"
            fill="currentColor"
            fillOpacity={0.35}
            strokeWidth="0.8"
          />
          {/* Hull segment lines */}
          <line x1="10" y1="16" x2="22" y2="16" strokeWidth="0.6" opacity="0.3" />
          <line x1="9" y1="22" x2="23" y2="22" strokeWidth="0.6" opacity="0.3" />
          {/* Flight deck / hangar bay */}
          <rect
            x="12"
            y="18"
            width="8"
            height="3"
            rx="0.5"
            fill="currentColor"
            fillOpacity={0.1}
            strokeWidth="0.7"
            opacity="0.5"
          />
          {/* Engine bank */}
          <line x1="12" y1="28" x2="12" y2="30" strokeWidth="1.2" opacity="0.5" />
          <line x1="16" y1="29" x2="16" y2="31" strokeWidth="1.5" opacity="0.6" />
          <line x1="20" y1="28" x2="20" y2="30" strokeWidth="1.2" opacity="0.5" />
        </>
      );
    // Support: repair/refuel (Vulcan / Apollo style)
    case 'support':
      return (
        <>
          {/* Rounded hull */}
          <path
            d="M16,8 L19,11 L22,15 L22,21 L19,25 L16,26 L13,25 L10,21 L10,15 L13,11 Z"
            strokeWidth="1.2"
            fill="currentColor"
            fillOpacity={0.25}
          />
          {/* Support cross */}
          <line x1="16" y1="13" x2="16" y2="23" strokeWidth="1.8" opacity="0.7" />
          <line x1="11" y1="18" x2="21" y2="18" strokeWidth="1.8" opacity="0.7" />
          {/* Service arms */}
          <line x1="10" y1="13" x2="7" y2="11" strokeWidth="1" opacity="0.4" />
          <line x1="22" y1="13" x2="25" y2="11" strokeWidth="1" opacity="0.4" />
          {/* Engine glow */}
          <line x1="14" y1="26" x2="14" y2="28" strokeWidth="1" opacity="0.5" />
          <line x1="18" y1="26" x2="18" y2="28" strokeWidth="1" opacity="0.5" />
        </>
      );
    // Mining: laser-nosed industrial (Prospector / MOLE style)
    case 'mining':
      return (
        <>
          {/* Bulky ore-processing hull */}
          <path
            d="M16,10 L19,12 L22,14 L23,18 L22,22 L20,26 L16,27 L12,26 L10,22 L9,18 L10,14 L13,12 Z"
            strokeWidth="1.2"
            fill="currentColor"
            fillOpacity={0.25}
          />
          {/* Mining laser arm */}
          <line x1="16" y1="10" x2="16" y2="5" strokeWidth="1.5" />
          <line x1="14.5" y1="5" x2="17.5" y2="5" strokeWidth="1.2" />
          {/* Laser emitter */}
          <circle cx="16" cy="4" r="1" fill="currentColor" fillOpacity={0.6} stroke="none" />
          {/* Ore saddle bags */}
          <path
            d="M9,16 L6,17 L6,21 L9,20"
            strokeWidth="0.8"
            fill="currentColor"
            fillOpacity={0.1}
          />
          <path
            d="M23,16 L26,17 L26,21 L23,20"
            strokeWidth="0.8"
            fill="currentColor"
            fillOpacity={0.1}
          />
          {/* Engine */}
          <line x1="16" y1="27" x2="16" y2="29" strokeWidth="2" opacity="0.5" />
        </>
      );
    // Salvage: claw ship (Reclaimer / Vulture style)
    case 'salvage':
      return (
        <>
          {/* Boxy industrial hull */}
          <path
            d="M14,10 L12,14 L10,16 L9,22 L11,26 L16,27 L21,26 L23,22 L22,16 L20,14 L18,10 Z"
            strokeWidth="1.2"
            fill="currentColor"
            fillOpacity={0.25}
          />
          {/* Salvage claw — three articulated prongs */}
          <path d="M13,10 L11,6 L10,4" strokeWidth="1.3" fill="none" />
          <path d="M16,9 L16,5 L16,3" strokeWidth="1.3" fill="none" />
          <path d="M19,10 L21,6 L22,4" strokeWidth="1.3" fill="none" />
          {/* Claw tips */}
          <circle cx="10" cy="4" r="0.8" fill="currentColor" fillOpacity={0.6} stroke="none" />
          <circle cx="16" cy="3" r="0.8" fill="currentColor" fillOpacity={0.6} stroke="none" />
          <circle cx="22" cy="4" r="0.8" fill="currentColor" fillOpacity={0.6} stroke="none" />
          {/* Processing bay hatch */}
          <rect
            x="13"
            y="17"
            width="6"
            height="4"
            rx="0.5"
            fill="currentColor"
            fillOpacity={0.1}
            strokeWidth="0.7"
            opacity="0.5"
          />
          {/* Engine */}
          <line x1="14" y1="27" x2="14" y2="29" strokeWidth="1.2" opacity="0.5" />
          <line x1="18" y1="27" x2="18" y2="29" strokeWidth="1.2" opacity="0.5" />
        </>
      );
    default:
      return null;
  }
};

const getUnitLabel = (unitType: TacticalUnitType): string => {
  switch (unitType) {
    case 'fighter':
      return 'Fighter';
    case 'bomber':
      return 'Bomber';
    case 'scout':
      return 'Scout/Recon';
    case 'transport':
      return 'Transport';
    case 'capital':
      return 'Capital Ship';
    case 'support':
      return 'Support';
    case 'mining':
      return 'Mining';
    case 'salvage':
      return 'Salvage';
    default:
      return 'Unknown';
  }
};

// ============================================================================
// TacticalIcon Component
// ============================================================================

export const TacticalIcon: React.FC<TacticalIconProps> = ({
  unitType,
  size = 'flight',
  color,
  width = 48,
  height = 56,
  label,
  selected = false,
  onClick,
  sx,
}) => {
  const theme = useTheme();
  const iconColor = color ?? theme.palette.primary.main;
  const tooltipText = label ?? `${getUnitLabel(unitType)} ${getSizeLabel(size)}`;

  return (
    <Tooltip title={tooltipText} arrow>
      <Box
        onClick={onClick}
        sx={{
          display: 'inline-flex',
          flexDirection: 'column',
          alignItems: 'center',
          cursor: onClick ? 'pointer' : 'default',
          color: iconColor,
          border: selected ? `2px solid ${theme.palette.warning.main}` : '2px solid transparent',
          borderRadius: 1,
          p: 0.25,
          transition: 'border-color 0.2s',
          '&:hover': onClick ? { borderColor: theme.palette.action.hover } : undefined,
          ...sx,
        }}
        role={onClick ? 'button' : undefined}
        tabIndex={onClick ? 0 : undefined}
        aria-label={tooltipText}
      >
        <svg
          width={width}
          height={height}
          viewBox="0 0 32 40"
          fill="none"
          stroke="currentColor"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Size echelon indicator above the frame */}
          <text
            x="16"
            y="5"
            textAnchor="middle"
            fontSize="5"
            fill="currentColor"
            stroke="none"
            fontWeight="bold"
            letterSpacing="1"
          >
            {getSizeIndicator(size)}
          </text>

          {/* Outer hexagonal frame */}
          <polygon
            points="16,7 29,14 29,29 16,36 3,29 3,14"
            strokeWidth="1.2"
            fill="currentColor"
            fillOpacity={selected ? 0.12 : 0.03}
          />

          {/* Inner frame outline (double-line HUD look) */}
          <polygon
            points="16,9 27,15 27,28 16,34 5,28 5,15"
            strokeWidth="0.5"
            opacity="0.3"
            fill="none"
          />

          {/* Top vertex chevron accent */}
          <path d="M12,9 L16,7 L20,9" strokeWidth="1.5" fill="none" opacity="0.6" />

          {/* Bottom tick marks */}
          <line x1="10" y1="32" x2="12" y2="31" strokeWidth="0.7" opacity="0.35" />
          <line x1="22" y1="32" x2="20" y2="31" strokeWidth="0.7" opacity="0.35" />

          {/* Side bracket accents */}
          <path d="M3,17 L1,18 L1,25 L3,26" strokeWidth="0.7" fill="none" opacity="0.25" />
          <path d="M29,17 L31,18 L31,25 L29,26" strokeWidth="0.7" fill="none" opacity="0.25" />

          {/* Unit type symbol inside the frame */}
          <g transform="translate(0, 4)">{getUnitSymbolPath(unitType)}</g>
        </svg>
      </Box>
    </Tooltip>
  );
};

// ============================================================================
// TacticalIconPalette — Toolbar for selecting tactical icons
// ============================================================================

export interface TacticalIconPaletteProps {
  readonly selectedUnit?: TacticalUnitType;
  readonly selectedSize?: FormationSize;
  readonly onSelectUnit: (unit: TacticalUnitType) => void;
  readonly onSelectSize: (size: FormationSize) => void;
}

const UNIT_TYPES: TacticalUnitType[] = [
  'fighter',
  'bomber',
  'scout',
  'transport',
  'capital',
  'support',
  'mining',
  'salvage',
];

const FORMATION_SIZES: FormationSize[] = ['element', 'flight', 'platoon', 'squadron', 'fleet'];

export const TacticalIconPalette: React.FC<TacticalIconPaletteProps> = ({
  selectedUnit,
  selectedSize = 'flight',
  onSelectUnit,
  onSelectSize,
}) => {
  const theme = useTheme();

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      {/* Formation Size */}
      <Box>
        <Box
          component="span"
          sx={{
            fontSize: '0.75rem',
            fontWeight: 600,
            color: 'text.secondary',
            mb: 0.5,
            display: 'block',
          }}
        >
          Formation Size
        </Box>
        <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
          {FORMATION_SIZES.map(size => (
            <Box
              key={size}
              onClick={() => onSelectSize(size)}
              sx={{
                px: 1,
                py: 0.5,
                fontSize: '0.75rem',
                borderRadius: 1,
                cursor: 'pointer',
                bgcolor:
                  selectedSize === size ? theme.palette.primary.main : theme.palette.action.hover,
                color: selectedSize === size ? theme.palette.primary.contrastText : 'text.primary',
                fontWeight: selectedSize === size ? 600 : 400,
                textTransform: 'capitalize',
                '&:hover': {
                  bgcolor:
                    selectedSize === size
                      ? theme.palette.primary.dark
                      : theme.palette.action.selected,
                },
              }}
              role="button"
              tabIndex={0}
              aria-pressed={selectedSize === size}
              aria-label={getSizeLabel(size)}
            >
              {size}
            </Box>
          ))}
        </Box>
      </Box>

      {/* Unit Types */}
      <Box>
        <Box
          component="span"
          sx={{
            fontSize: '0.75rem',
            fontWeight: 600,
            color: 'text.secondary',
            mb: 0.5,
            display: 'block',
          }}
        >
          Unit Type
        </Box>
        <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
          {UNIT_TYPES.map(unit => (
            <TacticalIcon
              key={unit}
              unitType={unit}
              size={selectedSize}
              selected={selectedUnit === unit}
              onClick={() => onSelectUnit(unit)}
              width={36}
              height={44}
            />
          ))}
        </Box>
      </Box>
    </Box>
  );
};
