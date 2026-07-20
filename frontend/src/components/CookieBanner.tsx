/**
 * Cookie Consent Banner Component
 *
 * Displays a banner on first visit to inform users about cookie usage
 * and obtain consent as required by GDPR and ePrivacy regulations.
 *
 * Essential cookies (authentication, security) are always allowed.
 * Users can customize preferences via the Privacy Settings page.
 */

import { logger } from '@/utils/logger';
import { alpha, Box, Stack, Typography, useTheme } from '@mui/material';
import React, { useEffect, useState } from 'react';
const COOKIE_CONSENT_KEY = 'cookie_consent_accepted';
const COOKIE_CONSENT_VERSION = '1.0';

interface CookieBannerProps {
  /** Optional callback when consent is given */
  onAccept?: () => void;
}

/**
 * Cookie Banner that appears at the bottom of the page for first-time visitors
 */
export const CookieBanner: React.FC<CookieBannerProps> = ({ onAccept }) => {
  const theme = useTheme();
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Check if user has already accepted cookies
    try {
      const consentData = localStorage.getItem(COOKIE_CONSENT_KEY);

      if (!consentData) {
        // No consent recorded, show banner
        setIsVisible(true);
      } else {
        try {
          const parsed = JSON.parse(consentData);
          // If version mismatch, show banner again
          if (parsed.version !== COOKIE_CONSENT_VERSION) {
            setIsVisible(true);
          }
        } catch {
          // Invalid data, show banner
          setIsVisible(true);
        }
      }
    } catch (error) {
      // localStorage might be disabled or throw security errors
      // Show banner to be safe
      logger.warn('Unable to access localStorage for cookie consent:', error);
      setIsVisible(true);
    }
  }, []);

  const handleAccept = () => {
    // Record consent in localStorage
    try {
      const consentData = {
        accepted: true,
        version: COOKIE_CONSENT_VERSION,
        timestamp: new Date().toISOString(),
      };
      localStorage.setItem(COOKIE_CONSENT_KEY, JSON.stringify(consentData));
    } catch (error) {
      // Handle localStorage errors (e.g., quota exceeded, disabled)
      logger.error(
        'Failed to save cookie consent:',
        error instanceof Error ? error : new Error(String(error))
      );
    }

    // Hide banner even if localStorage fails
    setIsVisible(false);

    // Callback if provided
    if (onAccept) {
      onAccept();
    }
  };

  const handleCustomize = () => {
    // Dismiss banner and navigate to privacy settings
    setIsVisible(false);
    // Use window.location for navigation instead of useNavigate hook
    window.location.href = '/privacy-settings';
  };

  const handleDismiss = () => {
    // Treat dismiss as implicit acceptance for essential cookies
    handleAccept();
  };

  if (!isVisible) {
    return null;
  }

  return (
    <Box
      sx={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 10,
        backgroundColor: alpha(theme.palette.background.paper, 0.95),
        backdropFilter: 'blur(8px)',
        borderTop: '1px solid',
        borderTopColor: alpha(theme.palette.primary.main, 0.3),
        boxShadow: `0 -2px 10px ${alpha(theme.palette.common.black, 0.3)}`,
      }}
    >
      <Box sx={{ maxWidth: '1200px', mx: 'auto', px: 2, py: 1 }}>
        <Stack
          direction="row"
          gap={1}
          alignItems="center"
          justifyContent="space-between"
          flexWrap="wrap"
        >
          <Box sx={{ flex: 1, minWidth: '250px' }}>
            <Typography sx={{ color: 'text.secondary', fontSize: '0.8rem', lineHeight: '1.4' }}>
              🍪 This website uses cookies for authentication and security.{' '}
              <a
                href="/privacy-settings"
                style={{
                  color: theme.palette.primary.main,
                  textDecoration: 'underline',
                  fontSize: '0.8rem',
                }}
              >
                Privacy Settings
              </a>
            </Typography>
          </Box>

          <Stack direction="row" gap={1} alignItems="center">
            <button
              onClick={handleCustomize}
              aria-label="Open privacy settings"
              style={{
                background: 'none',
                border: 'none',
                color: theme.palette.primary.main,
                fontSize: '0.8rem',
                cursor: 'pointer',
                padding: '4px 8px',
                textDecoration: 'underline',
              }}
            >
              Settings
            </button>
            <button
              onClick={handleAccept}
              aria-label="Accept cookies"
              style={{
                backgroundColor: 'transparent',
                border: `1px solid ${theme.palette.primary.main}`,
                color: theme.palette.primary.main,
                fontSize: '0.8rem',
                cursor: 'pointer',
                padding: '4px 12px',
                borderRadius: '4px',
              }}
            >
              Accept
            </button>
            <button
              onClick={handleDismiss}
              aria-label="Dismiss banner"
              style={{
                background: 'none',
                border: 'none',
                color: theme.palette.text.secondary,
                fontSize: '1rem',
                cursor: 'pointer',
                padding: '4px',
                lineHeight: '1',
              }}
            >
              ✕
            </button>
          </Stack>
        </Stack>
      </Box>
    </Box>
  );
};
