import CloseIcon from '@mui/icons-material/Close';
import ClockIcon from '@mui/icons-material/Schedule';
import StarIcon from '@mui/icons-material/Star';
import {
  alpha,
  Box,
  Button,
  ButtonGroup,
  Divider,
  IconButton,
  Menu,
  MenuItem,
  Stack,
  TextField,
  Typography,
  useTheme,
} from '@mui/material';
import React, { useState } from 'react';

interface CustomStatusSelectorProps {
  currentStatus?: {
    text: string;
    expiresAt?: number;
  };
  onStatusChange: (status: { text: string; expiresAt?: number } | null) => void;
}

// Preset statuses
const PRESET_STATUSES = [
  { text: 'In a meeting' },
  { text: 'Working remotely' },
  { text: 'On a break' },
  { text: 'Away for lunch' },
  { text: 'Do not disturb' },
  { text: 'In a voice call' },
  { text: 'Out of office' },
  { text: 'Commuting' },
  { text: 'In focus mode' },
  { text: 'Available for chat' },
];

const _DURATION_OPTIONS = [
  { label: '30 minutes', value: 30 * 60 * 1000 },
  { label: '1 hour', value: 60 * 60 * 1000 },
  { label: '2 hours', value: 2 * 60 * 60 * 1000 },
  { label: '4 hours', value: 4 * 60 * 60 * 1000 },
  { label: 'Today', value: 24 * 60 * 60 * 1000 },
  { label: 'This week', value: 7 * 24 * 60 * 60 * 1000 },
];

export const CustomStatusSelector: React.FC<CustomStatusSelectorProps> = ({
  currentStatus,
  onStatusChange,
}) => {
  const theme = useTheme();
  const [customText, setCustomText] = useState('');

  const handlePresetStatus = (preset: { text: string }, duration?: number) => {
    const expiresAt = duration ? Date.now() + duration : undefined;
    onStatusChange({
      text: preset.text,
      expiresAt,
    });
  };

  const handleCustomStatus = (duration?: number) => {
    if (!customText.trim()) return;

    const expiresAt = duration ? Date.now() + duration : undefined;
    onStatusChange({
      text: customText.trim(),
      expiresAt,
    });
    setCustomText('');
  };

  const handleClearStatus = () => {
    onStatusChange(null);
  };

  const isStatusExpired = (expiresAt?: number): boolean => {
    if (!expiresAt) return false;
    return Date.now() > expiresAt;
  };

  const formatTimeRemaining = (expiresAt: number): string => {
    const remaining = expiresAt - Date.now();
    const minutes = Math.floor(remaining / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d remaining`;
    if (hours > 0) return `${hours}h remaining`;
    if (minutes > 0) return `${minutes}m remaining`;
    return 'Expiring soon';
  };

  return (
    <Box sx={{ p: 2 }}>
      <Stack direction="column" spacing={2}>
        {currentStatus && !isStatusExpired(currentStatus.expiresAt) && (
          <Box
            sx={{
              p: 1.5,
              backgroundColor: alpha(theme.palette.primary.main, 0.1),
              borderRadius: '6px',
              border: `1px solid ${alpha(theme.palette.primary.main, 0.3)}`,
            }}
          >
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Stack direction="column" spacing={0.5}>
                <Typography sx={{ fontWeight: 600, fontSize: '0.875rem' }}>
                  {currentStatus.text}
                </Typography>
                {currentStatus.expiresAt && (
                  <Stack direction="row" spacing={0.5} alignItems="center">
                    <ClockIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
                    <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>
                      {formatTimeRemaining(currentStatus.expiresAt)}
                    </Typography>
                  </Stack>
                )}
              </Stack>
              <IconButton onClick={handleClearStatus} aria-label="Clear status">
                <CloseIcon />
              </IconButton>
            </Stack>
          </Box>
        )}

        <Divider />

        <Stack direction="column" spacing={1}>
          <Typography
            sx={{ fontSize: '0.875rem', fontWeight: 600, color: theme.palette.primary.main }}
          >
            Quick Presets
          </Typography>
          <Button
            variant="outlined"
            startIcon={<StarIcon />}
            aria-haspopup="true"
            aria-label="Set preset status"
            onClick={() => handlePresetStatus(PRESET_STATUSES[0])}
          >
            Set Preset Status
          </Button>
        </Stack>

        <Divider />

        <Stack direction="column" spacing={1.5}>
          <Typography
            sx={{ fontSize: '0.875rem', fontWeight: 600, color: theme.palette.primary.main }}
          >
            Custom Status
          </Typography>

          <TextField
            placeholder="What's your status?"
            value={customText}
            onChange={e => setCustomText(e.target.value)}
            inputProps={{ maxLength: 50 }}
            fullWidth
          />

          <ButtonGroup>
            <Button
              variant="contained"
              disabled={!customText.trim()}
              onClick={() => handleCustomStatus()}
            >
              Set Status
            </Button>
            <Menu open={false}>
              <MenuItem disabled>Duration options unavailable</MenuItem>
            </Menu>
          </ButtonGroup>
        </Stack>

        <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary', fontStyle: 'italic' }}>
          Your status will be visible to all members of your organization
        </Typography>
      </Stack>
    </Box>
  );
};
