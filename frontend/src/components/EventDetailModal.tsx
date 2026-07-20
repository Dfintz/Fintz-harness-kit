import CloseIcon from '@mui/icons-material/Close';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import {
  alpha,
  Box,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  Stack,
  Typography,
  useTheme,
} from '@mui/material';
import Button from '@mui/material/Button';
import React from 'react';
interface EventDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  event: {
    id: string;
    timestamp: number;
    type: string;
    category: 'fleet' | 'activity' | 'trading';
    title: string;
    description: string;
    color: string;
    rawData?: Record<string, unknown>;
  } | null;
}

export const EventDetailModal: React.FC<EventDetailModalProps> = ({ isOpen, onClose, event }) => {
  const theme = useTheme();
  if (!event || !isOpen) return null;

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  return (
    <Dialog
      open={isOpen}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          backgroundColor: theme.palette.background.paper,
          border: '1px solid',
          borderColor: theme.palette.divider,
          boxShadow: `0 8px 32px ${alpha(theme.palette.common.black, 0.5)}`,
        },
      }}
    >
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        Event Details
        <IconButton onClick={onClose} size="small" aria-label="Close">
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <Divider />
      <DialogContent>
        <Stack direction="column" gap={2} sx={{ mt: 1 }}>
          {/* Event Type Badge */}
          <Chip
            label={event.category}
            sx={{
              backgroundColor: `${event.color}20`,
              border: `1px solid ${event.color}`,
              color: event.color,
              fontWeight: 600,
              textTransform: 'uppercase',
            }}
          />

          {/* Title */}
          <Box>
            <Typography sx={{ fontSize: '0.75rem', color: theme.palette.text.secondary, mb: 0.5 }}>
              Title
            </Typography>
            <Typography sx={{ fontSize: '1.1rem', fontWeight: 600 }}>{event.title}</Typography>
          </Box>

          {/* Description */}
          <Box>
            <Typography sx={{ fontSize: '0.75rem', color: theme.palette.text.secondary, mb: 0.5 }}>
              Description
            </Typography>
            <Typography sx={{ fontSize: '0.9rem', lineHeight: 1.5 }}>
              {event.description}
            </Typography>
          </Box>

          <Divider />

          {/* Event Type */}
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Typography sx={{ fontSize: '0.75rem', color: theme.palette.text.secondary }}>
              Event Type
            </Typography>
            <Typography sx={{ fontSize: '0.875rem', fontFamily: 'monospace' }}>
              {event.type}
            </Typography>
          </Stack>

          {/* Timestamp */}
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Typography sx={{ fontSize: '0.75rem', color: theme.palette.text.secondary }}>
              Timestamp
            </Typography>
            <Typography sx={{ fontSize: '0.875rem' }}>{formatDate(event.timestamp)}</Typography>
          </Stack>

          {/* Event ID */}
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>Event ID</Typography>
            <Stack direction="row" gap={1} alignItems="center">
              <Typography
                sx={{ fontSize: '0.75rem', fontFamily: 'monospace', color: 'text.secondary' }}
              >
                {event.id.substring(0, 20)}...
              </Typography>
              <Button
                variant="outlined"
                size="small"
                onClick={() => copyToClipboard(event.id)}
                startIcon={<ContentCopyIcon fontSize="small" />}
              >
                Copy ID
              </Button>
            </Stack>
          </Stack>

          {/* Raw Data */}
          {event.rawData && (
            <>
              <Divider />
              <Box>
                <Stack
                  direction="row"
                  justifyContent="space-between"
                  alignItems="center"
                  sx={{ mb: 1 }}
                >
                  <Typography sx={{ fontSize: '0.75rem', color: theme.palette.text.secondary }}>
                    Raw Event Data
                  </Typography>
                  <Button
                    variant="outlined"
                    size="small"
                    onClick={() => copyToClipboard(JSON.stringify(event.rawData, null, 2))}
                    startIcon={<ContentCopyIcon fontSize="small" />}
                  >
                    Copy JSON
                  </Button>
                </Stack>
                <Box
                  sx={{
                    backgroundColor: theme.palette.background.paper,
                    border: '1px solid',
                    borderColor: theme.palette.divider,
                    borderRadius: '6px',
                    p: 1.5,
                    maxHeight: '300px',
                    overflowY: 'auto',
                    fontSize: '0.75rem',
                    fontFamily: 'monospace',
                    lineHeight: 1.4,
                  }}
                >
                  <Box
                    component="pre"
                    sx={{ m: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}
                  >
                    {JSON.stringify(event.rawData, null, 2)}
                  </Box>
                </Box>
              </Box>
            </>
          )}
        </Stack>
      </DialogContent>
      <Divider />
      <DialogActions>
        <Button variant="outlined" onClick={onClose}>
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
};
