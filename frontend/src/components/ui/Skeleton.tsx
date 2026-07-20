import React from 'react';

/**
 * Skeleton loading component for UI placeholders
 * Provides animated placeholder content while data is loading
 */

interface SkeletonProps {
  width?: string | number;
  height?: string | number;
  variant?: 'text' | 'rectangular' | 'circular' | 'card';
  animation?: 'pulse' | 'wave' | 'none';
  className?: string;
  count?: number;
}

export const Skeleton: React.FC<SkeletonProps> = ({
  width = '100%',
  height = '1rem',
  variant = 'text',
  animation = 'pulse',
  className = '',
  count = 1,
}) => {
  const getVariantStyles = (): React.CSSProperties => {
    const base: React.CSSProperties = {
      backgroundColor: 'var(--skeleton-bg, rgba(255, 255, 255, 0.1))',
      width: typeof width === 'number' ? `${width}px` : width,
      height: typeof height === 'number' ? `${height}px` : height,
    };

    switch (variant) {
      case 'circular': {
        // For circular variant, use width for both dimensions
        // Handle both number and string values
        const widthPx = typeof width === 'number' ? `${width}px` : undefined;
        const heightPx = typeof height === 'number' ? `${height}px` : undefined;
        const circularSize = widthPx ?? heightPx ?? width;
        return {
          ...base,
          borderRadius: '50%',
          width: circularSize,
          height: circularSize, // Use same value for both to ensure circle
        };
      }
      case 'rectangular':
      case 'text':
        return {
          ...base,
          borderRadius: '4px',
        };
      case 'card':
        return {
          ...base,
          borderRadius: '8px',
          padding: '1rem',
        };
      default:
        return {
          ...base,
          borderRadius: '4px',
        };
    }
  };

  const getAnimationClass = (): string => {
    switch (animation) {
      case 'pulse':
        return 'skeleton-pulse';
      case 'wave':
        return 'skeleton-wave';
      case 'none':
      default:
        return '';
    }
  };

  const skeletonElements = Array.from({ length: count }, (_, index) => (
    <div
      key={index}
      className={`skeleton ${getAnimationClass()} ${className}`}
      style={{
        ...getVariantStyles(),
        marginBottom: count > 1 && index < count - 1 ? '0.5rem' : undefined,
      }}
    />
  ));

  return (
    <>
      {skeletonElements}
      <style>{`
                .skeleton {
                    display: block;
                }

                .skeleton-pulse {
                    animation: skeleton-pulse 1.5s ease-in-out infinite;
                }

                .skeleton-wave {
                    position: relative;
                    overflow: hidden;
                }

                .skeleton-wave::after {
                    content: '';
                    position: absolute;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    transform: translateX(-100%);
                    background: linear-gradient(
                        90deg,
                        transparent,
                        rgba(255, 255, 255, 0.1),
                        transparent
                    );
                    animation: skeleton-wave 1.5s infinite;
                }

                @keyframes skeleton-pulse {
                    0%, 100% {
                        opacity: 1;
                    }
                    50% {
                        opacity: 0.4;
                    }
                }

                @keyframes skeleton-wave {
                    0% {
                        transform: translateX(-100%);
                    }
                    100% {
                        transform: translateX(100%);
                    }
                }

                @media (prefers-reduced-motion: reduce) {
                    @keyframes skeleton-pulse {
                        0%, 100% { opacity: 1; }
                    }
                    @keyframes skeleton-wave {
                        0%, 100% { transform: none; }
                    }
                }
            `}</style>
    </>
  );
};

/**
 * Card skeleton for loading states
 */
export const CardSkeleton: React.FC<{ count?: number }> = ({ count = 1 }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
    {Array.from({ length: count }, (_, index) => (
      <div
        key={index}
        style={{
          background: 'var(--bg-secondary)',
          borderRadius: '8px',
          padding: '1.5rem',
          border: '1px solid var(--border-color)',
        }}
      >
        <Skeleton width="60%" height="1.5rem" />
        <div style={{ marginTop: '1rem' }}>
          <Skeleton count={3} height="1rem" />
        </div>
      </div>
    ))}
  </div>
);

/**
 * Table skeleton for loading states
 */
export const TableSkeleton: React.FC<{ rows?: number; columns?: number }> = ({
  rows = 5,
  columns = 4,
}) => (
  <div
    style={{
      background: 'var(--bg-secondary)',
      borderRadius: '8px',
      overflow: 'hidden',
    }}
  >
    {/* Header */}
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${columns}, 1fr)`,
        gap: '1rem',
        padding: '1rem',
        borderBottom: '1px solid var(--border-color)',
      }}
    >
      {Array.from({ length: columns }, (_, index) => (
        <Skeleton key={index} width="80%" height="1rem" />
      ))}
    </div>
    {/* Rows */}
    {Array.from({ length: rows }, (_, rowIndex) => (
      <div
        key={rowIndex}
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${columns}, 1fr)`,
          gap: '1rem',
          padding: '1rem',
          borderBottom: rowIndex < rows - 1 ? '1px solid var(--border-color)' : undefined,
        }}
      >
        {Array.from({ length: columns }, (_, colIndex) => (
          <Skeleton key={colIndex} width={colIndex === 0 ? '90%' : '70%'} height="1rem" />
        ))}
      </div>
    ))}
  </div>
);

/**
 * List skeleton for loading states
 */
export const ListSkeleton: React.FC<{ count?: number }> = ({ count = 5 }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
    {Array.from({ length: count }, (_, index) => (
      <div
        key={index}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '1rem',
          padding: '0.75rem',
          background: 'var(--bg-secondary)',
          borderRadius: '4px',
        }}
      >
        <Skeleton variant="circular" width={40} height={40} />
        <div style={{ flex: 1 }}>
          <Skeleton width="50%" height="1rem" />
          <div style={{ marginTop: '0.5rem' }}>
            <Skeleton width="30%" height="0.75rem" />
          </div>
        </div>
      </div>
    ))}
  </div>
);

/**
 * Dashboard skeleton for loading states
 */
export const DashboardSkeleton: React.FC = () => (
  <div>
    {/* Header */}
    <div style={{ marginBottom: '2rem' }}>
      <Skeleton width="40%" height="2rem" />
      <div style={{ marginTop: '0.5rem' }}>
        <Skeleton width="60%" height="1rem" />
      </div>
    </div>

    {/* Stats Grid */}
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '1rem',
        marginBottom: '2rem',
      }}
    >
      {Array.from({ length: 4 }, (_, index) => (
        <div
          key={index}
          style={{
            background: 'var(--bg-secondary)',
            padding: '1.5rem',
            borderRadius: '8px',
          }}
        >
          <Skeleton width="50%" height="1rem" />
          <div style={{ marginTop: '0.5rem' }}>
            <Skeleton width="70%" height="2rem" />
          </div>
        </div>
      ))}
    </div>

    {/* Content Grid */}
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '1.5rem',
      }}
    >
      <CardSkeleton count={2} />
      <CardSkeleton count={2} />
    </div>
  </div>
);

/**
 * Profile skeleton for loading states
 */
export const ProfileSkeleton: React.FC = () => (
  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '2rem' }}>
    <Skeleton variant="circular" width={120} height={120} />
    <div style={{ flex: 1 }}>
      <Skeleton width="40%" height="2rem" />
      <div style={{ marginTop: '0.5rem' }}>
        <Skeleton width="60%" height="1rem" />
      </div>
      <div style={{ marginTop: '1.5rem' }}>
        <Skeleton count={4} height="1rem" />
      </div>
    </div>
  </div>
);
