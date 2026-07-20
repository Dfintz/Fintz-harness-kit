/**
 * LazyImage Component - Lazy loading image with native browser support
 *
 * Uses the native `loading="lazy"` attribute for modern browsers with
 * a fallback placeholder for better UX during loading.
 */

import React, { useState, useCallback } from 'react';
import { Box, Skeleton } from '@mui/material';

export interface LazyImageProps {
  /** Image source URL */
  src: string;
  /** Alt text for accessibility */
  alt: string;
  /** Image width */
  width?: number | string;
  /** Image height */
  height?: number | string;
  /** CSS object-fit property */
  objectFit?: 'contain' | 'cover' | 'fill' | 'none' | 'scale-down';
  /** Border radius */
  borderRadius?: number | string;
  /** Additional CSS styles */
  style?: React.CSSProperties;
  /** Additional CSS class */
  className?: string;
  /** Callback when image fails to load */
  onError?: () => void;
  /** Fallback element when image fails to load */
  fallback?: React.ReactNode;
  /** Show skeleton placeholder while loading */
  showSkeleton?: boolean;
}

/**
 * LazyImage component with native lazy loading and loading state
 *
 * @example
 * <LazyImage
 *   src="/ship-thumbnail.jpg"
 *   alt="Aurora MR"
 *   width={200}
 *   height={150}
 *   objectFit="cover"
 * />
 */
export function LazyImage({
  src,
  alt,
  width,
  height,
  objectFit = 'cover',
  borderRadius,
  style,
  className,
  onError,
  fallback,
  showSkeleton = true,
}: LazyImageProps): React.ReactElement {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  const handleLoad = useCallback(() => {
    setIsLoading(false);
  }, []);

  const handleError = useCallback(() => {
    setIsLoading(false);
    setHasError(true);
    onError?.();
  }, [onError]);

  // Show fallback on error
  if (hasError) {
    return (
      <>
        {fallback || (
          <Box
            sx={{
              width,
              height,
              borderRadius,
              backgroundColor: 'rgba(255, 255, 255, 0.05)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text-muted)',
              fontSize: '0.75rem',
            }}
            className={className}
          >
            Image unavailable
          </Box>
        )}
      </>
    );
  }

  return (
    <Box
      sx={{
        position: 'relative',
        width,
        height,
        borderRadius,
        overflow: 'hidden',
      }}
      className={className}
    >
      {/* Skeleton placeholder while loading */}
      {showSkeleton && isLoading && (
        <Skeleton
          variant="rectangular"
          animation="wave"
          sx={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            backgroundColor: 'rgba(255, 255, 255, 0.08)',
          }}
        />
      )}

      {/* Actual image with native lazy loading */}
      <img
        src={src}
        alt={alt}
        loading="lazy"
        decoding="async"
        onLoad={handleLoad}
        onError={handleError}
        style={{
          width: '100%',
          height: '100%',
          objectFit,
          borderRadius,
          opacity: isLoading ? 0 : 1,
          transition: 'opacity 0.3s ease',
          ...style,
        }}
      />
    </Box>
  );
}
