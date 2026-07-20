/**
 * Feature Gate Component
 * Conditionally renders children based on feature flag status
 */

import React, { ReactNode } from 'react';
import { useFeatureFlag } from '@/hooks/useFeatureFlag';

export interface FeatureGateProps {
  /**
   * The feature flag ID to check
   */
  flagId: string;

  /**
   * Content to render when the feature is enabled
   */
  children: ReactNode;

  /**
   * Optional content to render when the feature is disabled
   */
  fallback?: ReactNode;

  /**
   * Optional content to render while loading
   */
  loadingFallback?: ReactNode;

  /**
   * Whether to show children if there's an error checking the flag
   * @default false
   */
  showOnError?: boolean;

  /**
   * Default value to use if flag hasn't loaded yet
   * @default false
   */
  defaultValue?: boolean;
}

/**
 * FeatureGate component
 * Renders children only if the specified feature flag is enabled
 */
export const FeatureGate: React.FC<FeatureGateProps> = ({
  flagId,
  children,
  fallback = null,
  loadingFallback = null,
  showOnError = false,
  defaultValue = false,
}) => {
  const { isEnabled, isLoading, error } = useFeatureFlag(flagId, defaultValue);

  if (isLoading) {
    return <>{loadingFallback}</>;
  }

  if (error) {
    return <>{showOnError ? children : fallback}</>;
  }

  return <>{isEnabled ? children : fallback}</>;
};
