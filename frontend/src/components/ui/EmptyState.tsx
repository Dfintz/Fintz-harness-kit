/**
 * EmptyState Component - Engaging empty state with illustrations and CTAs
 *
 * A modern empty state component featuring:
 * - Custom SVG illustrations for different contexts
 * - Contextual messaging
 * - Primary and secondary action buttons
 * - Multiple size variants
 * - Preset configurations for common scenarios
 * - Full accessibility support
 *
 * @example
 * <EmptyState
 *   preset="fleet"
 *   primaryAction={{ label: 'Add Ship', onClick: handleAddShip }}
 * />
 *
 * @example
 * <EmptyState
 *   illustration="search"
 *   title="No results found"
 *   description="Try adjusting your search terms"
 * />
 */

import React from 'react';
import './EmptyState.css';
import {
    illustrations,
    type IllustrationProps,
    type IllustrationType,
} from './illustrations/EmptyStateIllustrations';

export type EmptyStateSize = 'sm' | 'md' | 'lg';

export interface EmptyStateAction {
  /** Button label */
  label: string;
  /** Click handler */
  onClick: () => void;
  /** Whether the button is disabled */
  disabled?: boolean;
}

export interface EmptyStateProps {
  /** Title text */
  title?: string;
  /** Description text */
  description?: string;
  /** Illustration type or custom React element */
  illustration?: IllustrationType | React.ReactElement;
  /** Illustration props (only for built-in illustrations) */
  illustrationProps?: IllustrationProps;
  /** Primary action button */
  primaryAction?: EmptyStateAction;
  /** Secondary action button */
  secondaryAction?: EmptyStateAction;
  /** Component size */
  size?: EmptyStateSize;
  /** Use a preset configuration */
  preset?: EmptyStatePreset;
  /** Additional class name */
  className?: string;
  /** Test ID for testing */
  testId?: string;
}

/**
 * Preset configurations for common empty states
 */
export type EmptyStatePreset =
  | 'fleet'
  | 'ships'
  | 'members'
  | 'events'
  | 'search'
  | 'inventory'
  | 'data'
  | 'error'
  | 'success';

interface PresetConfig {
  title: string;
  description: string;
  illustration: IllustrationType;
}

const presets: Record<EmptyStatePreset, PresetConfig> = {
  fleet: {
    title: 'No Ships in Your Fleet',
    description:
      "Your fleet is ready for new additions. Add your first ship to start building your organization's armada.",
    illustration: 'fleet',
  },
  ships: {
    title: 'Hangar is Empty',
    description:
      'No ships have been added to your personal hangar yet. Start by registering your spacecraft.',
    illustration: 'ships',
  },
  members: {
    title: 'No Members Found',
    description:
      "Your organization doesn't have any members yet. Invite pilots to join your ranks.",
    illustration: 'members',
  },
  events: {
    title: 'No Scheduled Events',
    description:
      'There are no upcoming operations or events. Plan your next tactical mission to rally the fleet.',
    illustration: 'events',
  },
  search: {
    title: 'No Results Found',
    description:
      "We couldn't find anything matching your search. Try adjusting your filters or search terms.",
    illustration: 'search',
  },
  inventory: {
    title: 'Inventory is Empty',
    description:
      'No items have been logged in the inventory. Start tracking your supplies and equipment.',
    illustration: 'inventory',
  },
  data: {
    title: 'No Data Available',
    description:
      "There's nothing to display here yet. Data will appear once you start using this feature.",
    illustration: 'data',
  },
  error: {
    title: 'Something Went Wrong',
    description:
      'We encountered an unexpected error. Please try again or contact support if the problem persists.',
    illustration: 'error',
  },
  success: {
    title: 'All Done!',
    description:
      "You've completed all tasks. Great work, Commander!",
    illustration: 'success',
  },
};

/**
 * Get illustration dimensions based on size
 */
const getIllustrationSize = (size: EmptyStateSize): { width: number; height: number } => {
  switch (size) {
    case 'sm':
      return { width: 140, height: 112 };
    case 'lg':
      return { width: 260, height: 208 };
    case 'md':
    default:
      return { width: 200, height: 160 };
  }
};

/**
 * EmptyState component with illustrations and CTAs
 */
export function EmptyState({
  title,
  description,
  illustration,
  illustrationProps,
  primaryAction,
  secondaryAction,
  size = 'md',
  preset,
  className = '',
  testId,
}: EmptyStateProps): React.ReactElement {
  // Get preset config if provided
  const presetConfig = preset ? presets[preset] : null;

  // Resolve values (props override presets)
  const resolvedTitle = title ?? presetConfig?.title ?? 'No Data';
  const resolvedDescription = description ?? presetConfig?.description;
  const resolvedIllustration = illustration ?? presetConfig?.illustration ?? 'data';

  // Get illustration dimensions
  const illustrationSize = getIllustrationSize(size);

  // Render illustration
  const renderIllustration = () => {
    if (React.isValidElement(resolvedIllustration)) {
      return resolvedIllustration;
    }

    const IllustrationComponent = illustrations[resolvedIllustration as IllustrationType];
    if (!IllustrationComponent) {
      return null;
    }

    return (
      <IllustrationComponent
        {...illustrationSize}
        {...illustrationProps}
      />
    );
  };

  const classNames = ['empty-state', `empty-state--${size}`, className].filter(Boolean).join(' ');

  return (
    <div className={classNames} data-testid={testId} role="status" aria-live="polite">
      <div className="empty-state__illustration">{renderIllustration()}</div>

      <div className="empty-state__content">
        <h3 className="empty-state__title">{resolvedTitle}</h3>

        {resolvedDescription && (
          <p className="empty-state__description">{resolvedDescription}</p>
        )}
      </div>

      {(primaryAction || secondaryAction) && (
        <div className="empty-state__actions">
          {primaryAction && (
            <button
              type="button"
              className="empty-state__action empty-state__action--primary"
              onClick={primaryAction.onClick}
              disabled={primaryAction.disabled}
            >
              {primaryAction.label}
            </button>
          )}
          {secondaryAction && (
            <button
              type="button"
              className="empty-state__action empty-state__action--secondary"
              onClick={secondaryAction.onClick}
              disabled={secondaryAction.disabled}
            >
              {secondaryAction.label}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
