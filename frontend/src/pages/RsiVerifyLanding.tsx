import CheckIcon from '@mui/icons-material/Check';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import VerifiedUserIcon from '@mui/icons-material/VerifiedUser';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Container,
  IconButton,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import React, { useState } from 'react';
import { useParams } from 'react-router-dom';

/**
 * RSI Verification Link Landing Page
 *
 * This is where a verification link (https://<frontend>/verify/rsi/<token>)
 * resolves when clicked. The link itself is meant to be pasted into a user's RSI
 * bio (or an organization's page) so the platform can confirm account
 * ownership — it is not a copy-paste code, just a link the user controls.
 *
 * The page explains what the link is for and lets the user re-copy the full link.
 */
export const RsiVerifyLanding: React.FC = () => {
  const { code = '' } = useParams<{ code: string }>();
  const [copied, setCopied] = useState(false);

  // The full link is exactly the current URL the user is viewing
  const fullLink = typeof window !== 'undefined' ? window.location.href : code;

  const handleCopy = (): void => {
    void navigator.clipboard
      .writeText(fullLink)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      })
      .catch(() => {
        setCopied(false);
      });
  };

  return (
    <Container maxWidth="sm" sx={{ py: 6 }}>
      <Box sx={{ textAlign: 'center', mb: 4 }}>
        <VerifiedUserIcon sx={{ fontSize: 64, color: 'primary.main', mb: 2 }} />
        <Typography variant="h4" gutterBottom>
          RSI Verification Link
        </Typography>
        <Typography variant="body1" color="text.secondary">
          This is a SC Fleet Manager verification link. Paste it into your RSI profile to prove you
          control your account or organization.
        </Typography>
      </Box>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Stack spacing={2}>
            <Typography variant="h6">How verification works</Typography>
            <Box component="ol" sx={{ pl: 3, m: 0 }}>
              <li>
                Log in to your RSI account at <strong>robertsspaceindustries.com</strong>.
              </li>
              <li>
                Paste this link into your <strong>Short Bio</strong> (for an organization, use the
                Introduction, History, Manifesto, or Charter).
              </li>
              <li>Save your changes on RSI.</li>
              <li>
                We&apos;ll detect the link automatically within a couple of minutes — no code to
                type by hand.
              </li>
            </Box>

            <Box
              sx={{
                p: 1.5,
                bgcolor: 'background.default',
                borderRadius: 1,
                border: '1px solid',
                borderColor: 'divider',
                fontFamily: 'monospace',
                fontSize: '0.9rem',
                wordBreak: 'break-all',
                display: 'flex',
                alignItems: 'center',
                gap: 1,
              }}
            >
              <Box sx={{ flex: 1, userSelect: 'all' }}>{fullLink}</Box>
              <Tooltip title={copied ? 'Copied!' : 'Copy link'}>
                <IconButton
                  size="small"
                  color={copied ? 'success' : 'default'}
                  onClick={handleCopy}
                  aria-label="Copy verification link"
                >
                  {copied ? <CheckIcon /> : <ContentCopyIcon />}
                </IconButton>
              </Tooltip>
            </Box>

            <Alert severity="info">
              Keep this link private until you&apos;ve added it to your RSI profile. You can remove
              it from your profile once verification completes.
            </Alert>

            <Button variant="contained" href="/profile" sx={{ alignSelf: 'flex-start' }}>
              Back to my profile
            </Button>
          </Stack>
        </CardContent>
      </Card>
    </Container>
  );
};
