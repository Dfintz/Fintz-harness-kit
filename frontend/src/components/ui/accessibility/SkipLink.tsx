/**
 * SkipLink Component - Skip to main content link for keyboard navigation
 *
 * This component provides a "skip to main content" link that appears when focused,
 * allowing keyboard users to bypass repetitive navigation and jump directly to
 * the main content. This is a WCAG 2.1 AA requirement (Success Criterion 2.4.1).
 *
 * @example
 * // In App.tsx or Layout component
 * <SkipLink targetId="main-content" />
 * <Header />
 * <main id="main-content" tabIndex={-1}>
 *   {children}
 * </main>
 */

import React from 'react';
import './SkipLink.css';

export interface SkipLinkProps {
  /** ID of the main content element to skip to */
  targetId: string;
  /** Custom text for the link (default: "Skip to main content") */
  children?: React.ReactNode;
  /** Additional class name */
  className?: string;
}

/**
 * SkipLink component for keyboard accessibility
 *
 * Place this component at the very top of your app/page layout,
 * before any navigation or header elements.
 */
export function SkipLink({
  targetId,
  children = 'Skip to main content',
  className = '',
}: SkipLinkProps): React.ReactElement {
  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    const target = document.getElementById(targetId);
    if (target) {
      // Make target focusable if it isn't
      if (!target.hasAttribute('tabindex')) {
        target.setAttribute('tabindex', '-1');
      }
      target.focus();
      // Scroll to target if available (may not be in test environment)
      if (typeof target.scrollIntoView === 'function') {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  };

  return (
    <a
      href={`#${targetId}`}
      className={`skip-link ${className}`.trim()}
      onClick={handleClick}
    >
      {children}
    </a>
  );
}
