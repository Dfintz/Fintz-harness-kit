/**
 * Empty State Illustrations - Custom SVG illustrations for empty states
 *
 * These illustrations provide visual context for empty states across the app.
 * All illustrations follow the Star Citizen Fleet Manager design system with
 * cyan accent colors and space/sci-fi theme.
 */

import React from 'react';

export interface IllustrationProps {
  /** Width of the illustration */
  width?: number | string;
  /** Height of the illustration */
  height?: number | string;
  /** Primary accent color */
  primaryColor?: string;
  /** Secondary/muted color */
  secondaryColor?: string;
  /** Additional class name */
  className?: string;
}

const defaultProps: IllustrationProps = {
  width: 200,
  height: 160,
  primaryColor: '#00d9ff',
  secondaryColor: '#2a3f5f',
};

/**
 * Empty fleet/ships illustration - a ship silhouette with stars
 */
export function ShipsIllustration({
  width = defaultProps.width,
  height = defaultProps.height,
  primaryColor = defaultProps.primaryColor,
  secondaryColor = defaultProps.secondaryColor,
  className,
}: Readonly<IllustrationProps>): React.ReactElement {
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 200 160"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      {/* Stars background */}
      <circle cx="20" cy="30" r="2" fill={primaryColor} opacity="0.4" />
      <circle cx="180" cy="40" r="1.5" fill={primaryColor} opacity="0.3" />
      <circle cx="45" cy="100" r="1" fill={primaryColor} opacity="0.5" />
      <circle cx="160" cy="120" r="2" fill={primaryColor} opacity="0.3" />
      <circle cx="90" cy="20" r="1.5" fill={primaryColor} opacity="0.4" />
      <circle cx="150" cy="80" r="1" fill={primaryColor} opacity="0.6" />

      {/* Main ship silhouette (dashed/incomplete) */}
      <g opacity="0.4">
        <path
          d="M100 45L130 70H145L160 85V95H145L130 85H70L55 95H40V85L55 70H70L100 45Z"
          stroke={secondaryColor}
          strokeWidth="2"
          strokeDasharray="6 4"
          fill="none"
        />
        {/* Cockpit */}
        <circle
          cx="100"
          cy="70"
          r="8"
          stroke={secondaryColor}
          strokeWidth="2"
          strokeDasharray="4 3"
          fill="none"
        />
        {/* Wings */}
        <path d="M60 75L40 95" stroke={secondaryColor} strokeWidth="2" strokeDasharray="4 3" />
        <path d="M140 75L160 95" stroke={secondaryColor} strokeWidth="2" strokeDasharray="4 3" />
      </g>

      {/* Plus icon (add action hint) */}
      <g transform="translate(85, 105)">
        <circle cx="15" cy="15" r="18" fill={secondaryColor} opacity="0.3" />
        <circle
          cx="15"
          cy="15"
          r="15"
          stroke={primaryColor}
          strokeWidth="2"
          fill="none"
          opacity="0.6"
        />
        <path
          d="M15 9V21M9 15H21"
          stroke={primaryColor}
          strokeWidth="2"
          strokeLinecap="round"
          opacity="0.8"
        />
      </g>
    </svg>
  );
}

/**
 * Empty members/users illustration - user silhouettes
 */
export function MembersIllustration({
  width = defaultProps.width,
  height = defaultProps.height,
  primaryColor = defaultProps.primaryColor,
  secondaryColor = defaultProps.secondaryColor,
  className,
}: Readonly<IllustrationProps>): React.ReactElement {
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 200 160"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      {/* Connection lines (network) */}
      <g opacity="0.2">
        <path
          d="M50 80L100 60L150 80"
          stroke={primaryColor}
          strokeWidth="1"
          strokeDasharray="4 4"
        />
        <path
          d="M70 100L100 85L130 100"
          stroke={primaryColor}
          strokeWidth="1"
          strokeDasharray="4 4"
        />
      </g>

      {/* Center user (main, highlighted) */}
      <g transform="translate(80, 40)">
        <circle
          cx="20"
          cy="15"
          r="12"
          stroke={primaryColor}
          strokeWidth="2"
          fill="none"
          opacity="0.6"
        />
        <path
          d="M5 50C5 40 12 35 20 35C28 35 35 40 35 50"
          stroke={primaryColor}
          strokeWidth="2"
          fill="none"
          opacity="0.6"
        />
      </g>

      {/* Left user (ghost) */}
      <g transform="translate(30, 60)" opacity="0.3">
        <circle
          cx="20"
          cy="12"
          r="10"
          stroke={secondaryColor}
          strokeWidth="2"
          strokeDasharray="4 3"
          fill="none"
        />
        <path
          d="M5 42C5 34 12 30 20 30C28 30 35 34 35 42"
          stroke={secondaryColor}
          strokeWidth="2"
          strokeDasharray="4 3"
          fill="none"
        />
      </g>

      {/* Right user (ghost) */}
      <g transform="translate(130, 60)" opacity="0.3">
        <circle
          cx="20"
          cy="12"
          r="10"
          stroke={secondaryColor}
          strokeWidth="2"
          strokeDasharray="4 3"
          fill="none"
        />
        <path
          d="M5 42C5 34 12 30 20 30C28 30 35 34 35 42"
          stroke={secondaryColor}
          strokeWidth="2"
          strokeDasharray="4 3"
          fill="none"
        />
      </g>

      {/* Invite hint */}
      <g transform="translate(85, 115)">
        <circle cx="15" cy="12" r="12" fill={secondaryColor} opacity="0.3" />
        <path
          d="M15 6V18M9 12H21"
          stroke={primaryColor}
          strokeWidth="2"
          strokeLinecap="round"
          opacity="0.7"
        />
      </g>
    </svg>
  );
}

/**
 * Empty events/calendar illustration - calendar with empty slots
 */
export function EventsIllustration({
  width = defaultProps.width,
  height = defaultProps.height,
  primaryColor = defaultProps.primaryColor,
  secondaryColor = defaultProps.secondaryColor,
  className,
}: Readonly<IllustrationProps>): React.ReactElement {
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 200 160"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      {/* Calendar base */}
      <rect
        x="40"
        y="35"
        width="120"
        height="95"
        rx="8"
        stroke={secondaryColor}
        strokeWidth="2"
        fill="none"
        opacity="0.5"
      />

      {/* Calendar header */}
      <rect x="40" y="35" width="120" height="25" rx="8" fill={secondaryColor} opacity="0.3" />
      <path d="M40 52H160" stroke={secondaryColor} strokeWidth="1" opacity="0.5" />

      {/* Calendar pins */}
      <rect x="65" y="28" width="6" height="14" rx="2" fill={primaryColor} opacity="0.5" />
      <rect x="130" y="28" width="6" height="14" rx="2" fill={primaryColor} opacity="0.5" />

      {/* Empty date cells (dashed) */}
      <g opacity="0.3">
        <rect
          x="50"
          y="65"
          width="25"
          height="20"
          rx="2"
          stroke={secondaryColor}
          strokeDasharray="3 2"
          fill="none"
        />
        <rect
          x="85"
          y="65"
          width="25"
          height="20"
          rx="2"
          stroke={secondaryColor}
          strokeDasharray="3 2"
          fill="none"
        />
        <rect
          x="120"
          y="65"
          width="25"
          height="20"
          rx="2"
          stroke={secondaryColor}
          strokeDasharray="3 2"
          fill="none"
        />
        <rect
          x="50"
          y="95"
          width="25"
          height="20"
          rx="2"
          stroke={secondaryColor}
          strokeDasharray="3 2"
          fill="none"
        />
        <rect
          x="85"
          y="95"
          width="25"
          height="20"
          rx="2"
          stroke={secondaryColor}
          strokeDasharray="3 2"
          fill="none"
        />
        <rect
          x="120"
          y="95"
          width="25"
          height="20"
          rx="2"
          stroke={secondaryColor}
          strokeDasharray="3 2"
          fill="none"
        />
      </g>

      {/* Add event hint */}
      <g transform="translate(85, 75)">
        <circle cx="15" cy="15" r="12" fill={primaryColor} opacity="0.15" />
        <path
          d="M15 9V21M9 15H21"
          stroke={primaryColor}
          strokeWidth="2"
          strokeLinecap="round"
          opacity="0.6"
        />
      </g>
    </svg>
  );
}

/**
 * Empty search results illustration - magnifying glass with no results
 */
export function SearchIllustration({
  width = defaultProps.width,
  height = defaultProps.height,
  primaryColor = defaultProps.primaryColor,
  secondaryColor = defaultProps.secondaryColor,
  className,
}: Readonly<IllustrationProps>): React.ReactElement {
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 200 160"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      {/* Magnifying glass */}
      <circle
        cx="90"
        cy="65"
        r="35"
        stroke={primaryColor}
        strokeWidth="3"
        fill="none"
        opacity="0.5"
      />
      <path
        d="M115 90L145 120"
        stroke={primaryColor}
        strokeWidth="4"
        strokeLinecap="round"
        opacity="0.5"
      />

      {/* X mark inside (no results) */}
      <g opacity="0.4">
        <path d="M75 50L105 80" stroke={secondaryColor} strokeWidth="3" strokeLinecap="round" />
        <path d="M105 50L75 80" stroke={secondaryColor} strokeWidth="3" strokeLinecap="round" />
      </g>

      {/* Question marks (confusion) */}
      <g opacity="0.3">
        <text x="45" y="45" fill={secondaryColor} fontSize="18" fontWeight="bold">
          ?
        </text>
        <text x="135" y="55" fill={secondaryColor} fontSize="14" fontWeight="bold">
          ?
        </text>
      </g>

      {/* Decorative dots */}
      <circle cx="30" cy="80" r="3" fill={primaryColor} opacity="0.2" />
      <circle cx="170" cy="70" r="2" fill={primaryColor} opacity="0.3" />
      <circle cx="55" cy="130" r="2" fill={primaryColor} opacity="0.2" />
    </svg>
  );
}

/**
 * Empty data/general illustration - empty box/container
 */
export function DataIllustration({
  width = defaultProps.width,
  height = defaultProps.height,
  primaryColor = defaultProps.primaryColor,
  secondaryColor = defaultProps.secondaryColor,
  className,
}: Readonly<IllustrationProps>): React.ReactElement {
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 200 160"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      {/* 3D Box - front face */}
      <path
        d="M50 60L100 35L150 60L150 110L100 135L50 110Z"
        stroke={secondaryColor}
        strokeWidth="2"
        fill="none"
        opacity="0.4"
      />

      {/* Box - top face */}
      <path
        d="M50 60L100 35L150 60L100 85Z"
        stroke={secondaryColor}
        strokeWidth="2"
        fill={secondaryColor}
        opacity="0.15"
      />

      {/* Box center line */}
      <path d="M100 85V135" stroke={secondaryColor} strokeWidth="1" opacity="0.3" />

      {/* Open lid indication */}
      <path
        d="M100 35L100 20L140 40L150 60"
        stroke={primaryColor}
        strokeWidth="2"
        strokeDasharray="4 3"
        fill="none"
        opacity="0.4"
      />

      {/* Empty sparkles */}
      <g opacity="0.3">
        <path d="M80 50L85 55L80 60L75 55Z" fill={primaryColor} />
        <path d="M120 70L123 73L120 76L117 73Z" fill={primaryColor} />
      </g>

      {/* Decorative circles */}
      <circle cx="35" cy="90" r="2" fill={primaryColor} opacity="0.3" />
      <circle cx="165" cy="85" r="1.5" fill={primaryColor} opacity="0.4" />
      <circle cx="100" cy="145" r="2" fill={primaryColor} opacity="0.2" />
    </svg>
  );
}

/**
 * Error/problem illustration - warning triangle
 */
export function ErrorIllustration({
  width = defaultProps.width,
  height = defaultProps.height,
  primaryColor = '#ff6b6b',
  secondaryColor = defaultProps.secondaryColor,
  className,
}: Readonly<IllustrationProps>): React.ReactElement {
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 200 160"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      {/* Warning triangle */}
      <path
        d="M100 30L160 120H40L100 30Z"
        stroke={primaryColor}
        strokeWidth="3"
        fill="none"
        opacity="0.5"
      />

      {/* Exclamation mark */}
      <path
        d="M100 60V85"
        stroke={primaryColor}
        strokeWidth="4"
        strokeLinecap="round"
        opacity="0.6"
      />
      <circle cx="100" cy="100" r="4" fill={primaryColor} opacity="0.6" />

      {/* Glitch lines */}
      <g opacity="0.3">
        <path d="M30 70H50" stroke={secondaryColor} strokeWidth="2" />
        <path d="M150 80H170" stroke={secondaryColor} strokeWidth="2" />
        <path d="M25 90H40" stroke={secondaryColor} strokeWidth="1" />
        <path d="M160 95H175" stroke={secondaryColor} strokeWidth="1" />
      </g>

      {/* Static noise dots */}
      <circle cx="45" cy="50" r="2" fill={secondaryColor} opacity="0.4" />
      <circle cx="155" cy="55" r="1.5" fill={secondaryColor} opacity="0.4" />
      <circle cx="70" cy="130" r="2" fill={secondaryColor} opacity="0.3" />
      <circle cx="130" cy="135" r="1.5" fill={secondaryColor} opacity="0.3" />
    </svg>
  );
}

/**
 * Success/completion illustration - checkmark
 */
export function SuccessIllustration({
  width = defaultProps.width,
  height = defaultProps.height,
  primaryColor = '#00ff88',
  secondaryColor: _secondaryColor = defaultProps.secondaryColor,
  className,
}: Readonly<IllustrationProps>): React.ReactElement {
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 200 160"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      {/* Main circle */}
      <circle
        cx="100"
        cy="80"
        r="45"
        stroke={primaryColor}
        strokeWidth="3"
        fill="none"
        opacity="0.4"
      />

      {/* Checkmark */}
      <path
        d="M75 80L90 95L125 60"
        stroke={primaryColor}
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.7"
      />

      {/* Celebration sparkles */}
      <g opacity="0.5">
        <path d="M40 50L45 55L40 60L35 55Z" fill={primaryColor} />
        <path d="M160 60L163 63L160 66L157 63Z" fill={primaryColor} />
        <path d="M55 120L58 123L55 126L52 123Z" fill={primaryColor} />
        <path d="M145 115L148 118L145 121L142 118Z" fill={primaryColor} />
      </g>

      {/* Glow rings */}
      <circle cx="100" cy="80" r="55" stroke={primaryColor} strokeWidth="1" opacity="0.2" />
      <circle cx="100" cy="80" r="65" stroke={primaryColor} strokeWidth="1" opacity="0.1" />
    </svg>
  );
}

/**
 * Empty inventory/logistics illustration - crate with items
 */
export function InventoryIllustration({
  width = defaultProps.width,
  height = defaultProps.height,
  primaryColor = defaultProps.primaryColor,
  secondaryColor = defaultProps.secondaryColor,
  className,
}: Readonly<IllustrationProps>): React.ReactElement {
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 200 160"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      {/* Crate - main body */}
      <rect
        x="45"
        y="50"
        width="110"
        height="75"
        rx="4"
        stroke={secondaryColor}
        strokeWidth="2"
        fill="none"
        opacity="0.5"
      />

      {/* Crate horizontal bands */}
      <path d="M45 75H155" stroke={secondaryColor} strokeWidth="1" opacity="0.3" />
      <path d="M45 100H155" stroke={secondaryColor} strokeWidth="1" opacity="0.3" />

      {/* Crate vertical bands */}
      <path d="M80 50V125" stroke={secondaryColor} strokeWidth="1" opacity="0.3" />
      <path d="M120 50V125" stroke={secondaryColor} strokeWidth="1" opacity="0.3" />

      {/* Empty shelf lines (dashed) */}
      <g opacity="0.3">
        <path d="M55 65H75" stroke={secondaryColor} strokeDasharray="3 2" />
        <path d="M125 65H145" stroke={secondaryColor} strokeDasharray="3 2" />
        <path d="M55 90H75" stroke={secondaryColor} strokeDasharray="3 2" />
        <path d="M125 90H145" stroke={secondaryColor} strokeDasharray="3 2" />
        <path d="M55 115H75" stroke={secondaryColor} strokeDasharray="3 2" />
        <path d="M125 115H145" stroke={secondaryColor} strokeDasharray="3 2" />
      </g>

      {/* Add item hint */}
      <g transform="translate(85, 72)">
        <circle cx="15" cy="15" r="15" fill={primaryColor} opacity="0.15" />
        <path
          d="M15 8V22M8 15H22"
          stroke={primaryColor}
          strokeWidth="2"
          strokeLinecap="round"
          opacity="0.6"
        />
      </g>

      {/* Floating dust particles */}
      <circle cx="30" cy="70" r="2" fill={primaryColor} opacity="0.2" />
      <circle cx="170" cy="90" r="1.5" fill={primaryColor} opacity="0.3" />
    </svg>
  );
}

/**
 * Map of illustration types to components
 */
export const illustrations = {
  ships: ShipsIllustration,
  fleet: ShipsIllustration,
  members: MembersIllustration,
  users: MembersIllustration,
  events: EventsIllustration,
  calendar: EventsIllustration,
  search: SearchIllustration,
  data: DataIllustration,
  general: DataIllustration,
  error: ErrorIllustration,
  success: SuccessIllustration,
  inventory: InventoryIllustration,
  logistics: InventoryIllustration,
} as const;

export type IllustrationType = keyof typeof illustrations;
