import { Box, TextField } from '@mui/material';
import React from 'react';
interface MentionInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
  width?: string | number;
  isDisabled?: boolean;
}

/**
 * Simplified MentionInput component
 * Note: Mention suggestions have been removed as they depended on the User Presence feature
 */
export const MentionInput: React.FC<MentionInputProps> = ({
  value,
  onChange,
  placeholder = 'Type your message',
  label,
  width = '100%',
  isDisabled = false,
}) => {
  return (
    <Box position="relative" width={width}>
      <TextField
        label={label}
        placeholder={placeholder}
        value={value}
        onChange={e => onChange(e.target.value)}
        disabled={isDisabled}
        fullWidth
        inputProps={{ 'aria-label': label || placeholder }}
      />
    </Box>
  );
};
