/**
 * Two-Factor Authentication Input Component
 *
 * Provides a UI for entering 2FA codes when required for sensitive operations.
 */

import { TypographyField } from '@/components/ui/SpectrumCompat';
import { Alert, Box, Stack, Typography } from '@mui/material';
import React from 'react';
interface TwoFactorInputProps {
  /** Whether 2FA input is required */
  required: boolean;
  /** Current 2FA code value */
  value: string;
  /** Callback when code changes */
  onChange: (value: string) => void;
  /** Whether the input is disabled */
  disabled?: boolean;
  /** Validation error message */
  errorMessage?: string;
}

/**
 * Component for entering 2FA codes for sensitive operations
 */
export const TwoFactorInput: React.FC<TwoFactorInputProps> = ({
  required,
  value,
  onChange,
  disabled = false,
  errorMessage,
}) => {
  if (!required) {
    return null;
  }

  return (
    <Box mt={2}>
      <Box sx={{ borderRadius: 1, p: 2, borderColor: 'primary.main' }}>
        <Stack direction="column" spacing={2}>
          <Stack direction="row" spacing={1} alignItems="center">
            <Alert sx={{ color: 'primary.main' }} />
            <Typography variant="subtitle1" margin={0}>
              Two-Factor Authentication Required
            </Typography>
          </Stack>

          <Typography>
            This is a sensitive operation that requires two-factor authentication. Please enter your
            6-digit verification code from your authenticator app.
          </Typography>

          <TypographyField
            label="2FA Verification Code"
            placeholder="000000"
            value={value}
            onChange={onChange}
            disabled={disabled}
            maxLength={6}
            inputMode="numeric"
            pattern="[0-9]*"
            validationState={errorMessage ? 'invalid' : undefined}
            errorMessage={errorMessage}
            description="Enter the 6-digit code from your authenticator app"
            width="100%"
            autoComplete="one-time-code"
          />

          <Typography sx={{ fontSize: '0.875rem', color: 'text.secondary' }}>
            If you don't have access to your authenticator app, you can use a backup code instead.
          </Typography>
        </Stack>
      </Box>
    </Box>
  );
};
