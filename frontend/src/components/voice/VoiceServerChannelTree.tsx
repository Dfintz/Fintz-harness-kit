/**
 * VoiceServerChannelTree — Displays channel hierarchy with online users.
 *
 * Uses MUI List + Collapse for nested tree rendering.
 * Shows user count per channel and connected users with status icons.
 */

import {
  ChevronRight as ChevronRightIcon,
  ExpandMore as ExpandMoreIcon,
  Forum as ForumIcon,
  Headset as HeadsetIcon,
  HeadsetOff as HeadsetOffIcon,
  MicOff as MicOffIcon,
  Person as PersonIcon,
} from '@mui/icons-material';
import {
  Box,
  Chip,
  Collapse,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Stack,
  Typography,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import type { VoiceServerChannel } from '@sc-fleet-manager/shared-types';
import React, { useState } from 'react';

interface VoiceServerChannelTreeProps {
  channels?: VoiceServerChannel[];
}

function getChildren(
  channels: VoiceServerChannel[],
  parentId: number | null
): VoiceServerChannel[] {
  return channels
    .filter(ch => ch.parentId === parentId)
    .sort((a, b) => a.name.localeCompare(b.name));
}

const ChannelNode: React.FC<
  Readonly<{ channel: VoiceServerChannel; allChannels: VoiceServerChannel[]; depth: number }>
> = ({ channel, allChannels, depth }) => {
  const theme = useTheme();
  const children = getChildren(allChannels, channel.id);
  const hasContent = children.length > 0 || (channel.users && channel.users.length > 0);
  const [open, setOpen] = useState(true);

  return (
    <>
      <ListItemButton
        onClick={() => {
          if (hasContent) {
            setOpen(prev => !prev);
          }
        }}
        sx={{ pl: 2 + depth * 2 }}
        dense
      >
        <ListItemIcon sx={{ minWidth: 28 }}>
          {hasContent ? (
            open ? (
              <ExpandMoreIcon fontSize="small" />
            ) : (
              <ChevronRightIcon fontSize="small" />
            )
          ) : (
            <ForumIcon sx={{ fontSize: 16, color: theme.palette.text.secondary }} />
          )}
        </ListItemIcon>
        <ListItemText
          primary={
            <Stack direction="row" alignItems="center" spacing={1}>
              <ForumIcon sx={{ fontSize: 16, color: theme.palette.text.secondary }} />
              <Typography variant="body2">{channel.name}</Typography>
              {channel.userCount > 0 && (
                <Chip label={channel.userCount} size="small" color="primary" variant="outlined" />
              )}
            </Stack>
          }
        />
      </ListItemButton>

      {hasContent && (
        <Collapse in={open} timeout="auto" unmountOnExit>
          <List disablePadding>
            {channel.users?.map((user, idx) => (
              <ListItem key={`${channel.id}-user-${idx}`} sx={{ pl: 4 + depth * 2 }} dense>
                <ListItemIcon sx={{ minWidth: 28 }}>
                  {user.isMuted ? (
                    <MicOffIcon sx={{ fontSize: 16, color: theme.palette.warning.main }} />
                  ) : user.isDeafened ? (
                    <HeadsetOffIcon sx={{ fontSize: 16, color: theme.palette.error.main }} />
                  ) : (
                    <PersonIcon sx={{ fontSize: 16, color: theme.palette.success.main }} />
                  )}
                </ListItemIcon>
                <ListItemText
                  primary={user.displayName}
                  secondary={
                    user.sessionMinutes !== undefined
                      ? `${Math.floor(user.sessionMinutes / 60)}h ${user.sessionMinutes % 60}m`
                      : undefined
                  }
                  primaryTypographyProps={{ variant: 'body2' }}
                  secondaryTypographyProps={{ variant: 'caption' }}
                />
              </ListItem>
            ))}
            {children.map(child => (
              <ChannelNode
                key={child.id}
                channel={child}
                allChannels={allChannels}
                depth={depth + 1}
              />
            ))}
          </List>
        </Collapse>
      )}
    </>
  );
};

export const VoiceServerChannelTree: React.FC<Readonly<VoiceServerChannelTreeProps>> = ({
  channels,
}) => {
  const theme = useTheme();

  if (!channels || channels.length === 0) {
    return (
      <Box sx={{ p: 2, textAlign: 'center' }}>
        <HeadsetIcon sx={{ fontSize: 48, color: theme.palette.text.disabled, mb: 1 }} />
        <Typography variant="body2" color="text.secondary">
          No channel data available. The server&apos;s CVP bridge may be offline or ICE connection
          is not configured.
        </Typography>
      </Box>
    );
  }

  const rootChannels = getChildren(channels, null);
  const displayChannels = rootChannels.length > 0 ? rootChannels : getChildren(channels, 0);

  return (
    <List dense disablePadding>
      {displayChannels.map(channel => (
        <ChannelNode key={channel.id} channel={channel} allChannels={channels} depth={0} />
      ))}
    </List>
  );
};
