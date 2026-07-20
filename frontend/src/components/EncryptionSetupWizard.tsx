/**
 * Encryption Setup Wizard Component
 * Guides users through enabling end-to-end encryption for their organization
 */

import { encryptionApiService } from '@/services/crypto/encryptionApiService';
import {
  generateOrganizationKey,
  validatePasswordStrength,
  wrapKeyWithPassword,
} from '@/services/crypto/encryptionService';
import { logger } from '@/utils/logger';
import {
  CheckCircle as CheckIcon,
  ContentCopy as CopyIcon,
  Key as KeyIcon,
  Lock as LockIcon,
} from '@mui/icons-material';
import {
  Alert,
  AlertTitle,
  Box,
  Button,
  Checkbox,
  LinearProgress,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Paper,
  Step,
  StepLabel,
  Stepper,
  TextField,
  Typography,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import React, { useState } from 'react';

interface EncryptionSetupWizardProps {
  organizationId: string;
  organizationName: string;
  userId: string;
  onComplete: () => void;
  onCancel: () => void;
}

const steps = [
  'Introduction',
  'Generate Encryption Key',
  'Save Recovery Phrase',
  'Set Password',
  'Confirmation',
];

export const EncryptionSetupWizard: React.FC<EncryptionSetupWizardProps> = ({
  organizationId,
  organizationName,
  userId,
  onComplete,
  onCancel,
}) => {
  const [activeStep, setActiveStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Encryption data
  const [encryptionKey, setEncryptionKey] = useState<CryptoKey | null>(null);
  const [keyId, setKeyId] = useState<string>('');
  const [recoveryPhrase, setRecoveryPhrase] = useState<string>('');
  const [exportedKey, setExportedKey] = useState<ArrayBuffer | null>(null);

  // User inputs
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [_recoveryPhraseConfirmed, setRecoveryPhraseConfirmed] = useState(false);
  const [understandsRisks, setUnderstandsRisks] = useState(false);

  // Recovery phrase verification
  const [verificationWords, setVerificationWords] = useState<number[]>([]);
  const [verificationInput, setVerificationInput] = useState<Record<number, string>>({});

  const handleNext = () => {
    setActiveStep(prev => prev + 1);
  };

  const handleBack = () => {
    setActiveStep(prev => prev - 1);
  };

  const handleGenerateKey = async () => {
    try {
      setLoading(true);
      setError(null);

      const generated = await generateOrganizationKey();
      setEncryptionKey(generated.key);
      setKeyId(generated.keyId);
      setRecoveryPhrase(generated.recoveryPhrase);
      setExportedKey(generated.exportedKey);

      // Generate random word positions for verification (3 words)
      const wordCount = generated.recoveryPhrase.split(' ').length;
      const positions: number[] = [];
      while (positions.length < 3) {
        const pos = Math.floor(Math.random() * wordCount);
        if (!positions.includes(pos)) {
          positions.push(pos);
        }
      }
      setVerificationWords([...positions].sort((a, b) => a - b));

      handleNext();
    } catch (err) {
      logger.error('Failed to generate encryption key:', err);
      setError('Failed to generate encryption key. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyRecoveryPhrase = () => {
    const words = recoveryPhrase.split(' ');
    let allCorrect = true;

    for (const pos of verificationWords) {
      if (verificationInput[pos]?.toLowerCase() !== words[pos].toLowerCase()) {
        allCorrect = false;
        break;
      }
    }

    if (allCorrect) {
      setRecoveryPhraseConfirmed(true);
      handleNext();
    } else {
      setError('Verification failed. Please check the words and try again.');
    }
  };

  const handleFinalizeEncryption = async () => {
    if (!encryptionKey || !exportedKey) {
      setError('Encryption key not generated');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    const passwordValidation = validatePasswordStrength(password);
    if (!passwordValidation.valid) {
      setError(`Weak password: ${passwordValidation.feedback.join(', ')}`);
      return;
    }

    if (!understandsRisks) {
      setError('You must acknowledge the risks before proceeding');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Wrap key with password
      const wrappedKey = await wrapKeyWithPassword(exportedKey, password);

      // Initialize encryption on server
      await encryptionApiService.initializeEncryption(organizationId, keyId, 'AES-256-GCM', {
        [userId]: JSON.stringify(wrappedKey),
      });

      handleNext();
    } catch (err) {
      logger.error('Failed to initialize encryption:', err);
      setError('Failed to enable encryption. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const renderStepContent = () => {
    switch (activeStep) {
      case 0:
        // Introduction
        return (
          <Box>
            <Alert severity="info" sx={{ mb: 3 }}>
              <AlertTitle>End-to-End Encryption</AlertTitle>
              Enable encryption to protect sensitive organizational data. Only members with the
              encryption key can access encrypted information.
            </Alert>

            <Typography variant="h6" gutterBottom>
              How It Works
            </Typography>
            <List>
              <ListItem>
                <ListItemIcon>
                  <KeyIcon color="primary" />
                </ListItemIcon>
                <ListItemText
                  primary="Encryption Key Generated"
                  secondary="A unique 256-bit encryption key is generated on your device"
                />
              </ListItem>
              <ListItem>
                <ListItemIcon>
                  <LockIcon color="primary" />
                </ListItemIcon>
                <ListItemText
                  primary="Data Encrypted Locally"
                  secondary="Sensitive data is encrypted in your browser before being sent to the server"
                />
              </ListItem>
              <ListItem>
                <ListItemIcon>
                  <CheckIcon color="success" />
                </ListItemIcon>
                <ListItemText
                  primary="Zero-Knowledge Security"
                  secondary="Platform administrators cannot access your encrypted data"
                />
              </ListItem>
            </List>

            <Alert severity="warning" sx={{ mt: 3 }}>
              <AlertTitle>Important: Key Management Responsibility</AlertTitle>
              <Typography variant="body2" paragraph>
                • You will receive a 24-word recovery phrase
              </Typography>
              <Typography variant="body2" paragraph>
                • This is the ONLY way to recover your encryption key
              </Typography>
              <Typography variant="body2" paragraph>
                • If you lose both your password and recovery phrase, encrypted data is{' '}
                <strong>permanently lost</strong>
              </Typography>
              <Typography variant="body2">
                • We recommend storing the recovery phrase in a secure password manager
              </Typography>
            </Alert>

            <Box mt={3} display="flex" gap={2} justifyContent="flex-end">
              <Button onClick={onCancel}>Cancel</Button>
              <Button variant="contained" onClick={handleNext}>
                Continue
              </Button>
            </Box>
          </Box>
        );

      case 1:
        // Generate Key
        return (
          <Box>
            <Typography variant="h6" gutterBottom>
              Generate Encryption Key
            </Typography>
            <Typography color="textSecondary" paragraph>
              Click the button below to generate a secure encryption key for{' '}
              <strong>{organizationName}</strong>.
            </Typography>

            {loading && <LinearProgress sx={{ mb: 2 }} />}

            <Box display="flex" justifyContent="center" my={4}>
              <Button
                variant="contained"
                size="large"
                startIcon={<KeyIcon />}
                onClick={handleGenerateKey}
                disabled={loading || !!encryptionKey}
              >
                {encryptionKey ? 'Key Generated ✓' : 'Generate Encryption Key'}
              </Button>
            </Box>
          </Box>
        );

      case 2:
        // Save Recovery Phrase
        return (
          <Box>
            <Alert severity="error" sx={{ mb: 3 }}>
              <AlertTitle>CRITICAL: Save Your Recovery Phrase</AlertTitle>
              Write down these 24 words in order and store them securely. This is your ONLY way to
              recover access if you forget your password.
            </Alert>

            <Paper
              elevation={3}
              sx={{
                p: 3,
                mb: 3,
                backgroundColor: 'grey.100',
                fontFamily: 'monospace',
                fontSize: '1.1rem',
              }}
            >
              {recoveryPhrase}
            </Paper>

            <Button
              variant="outlined"
              startIcon={<CopyIcon />}
              onClick={() => copyToClipboard(recoveryPhrase)}
              fullWidth
              sx={{ mb: 3 }}
            >
              Copy to Clipboard
            </Button>

            <Alert severity="info" sx={{ mb: 3 }}>
              <Typography variant="body2" fontWeight="bold" gutterBottom>
                Recommended Storage Methods:
              </Typography>
              <Typography variant="body2">
                • Password manager (1Password, LastPass, Bitwarden)
                <br />
                • Write on paper and store in a safe
                <br />• Split across multiple secure locations
              </Typography>
            </Alert>

            <Typography variant="h6" gutterBottom sx={{ mt: 4 }}>
              Verify Your Recovery Phrase
            </Typography>
            <Typography color="textSecondary" paragraph>
              To ensure you've saved it correctly, please enter the following words:
            </Typography>

            {verificationWords.map(pos => (
              <TextField
                key={pos}
                label={`Word #${pos + 1}`}
                fullWidth
                sx={{ mb: 2 }}
                value={verificationInput[pos] || ''}
                onChange={e => setVerificationInput(prev => ({ ...prev, [pos]: e.target.value }))}
              />
            ))}

            <Box mt={3} display="flex" gap={2} justifyContent="flex-end">
              <Button onClick={handleBack}>Back</Button>
              <Button
                variant="contained"
                onClick={handleVerifyRecoveryPhrase}
                disabled={verificationWords.some(pos => !verificationInput[pos])}
              >
                Verify & Continue
              </Button>
            </Box>
          </Box>
        );

      case 3:
        // Set Password
        return (
          <Box>
            <Typography variant="h6" gutterBottom>
              Set Encryption Password
            </Typography>
            <Typography color="textSecondary" paragraph>
              This password will be used to unlock your encryption key. Choose a strong password
              that you'll remember.
            </Typography>

            <TextField
              label="Password"
              type="password"
              fullWidth
              value={password}
              onChange={e => setPassword(e.target.value)}
              sx={{ mb: 2 }}
              helperText="At least 12 characters with uppercase, lowercase, numbers, and symbols"
            />

            {password && (
              <Box mb={2}>
                <Typography variant="caption" color="textSecondary">
                  Password Strength:
                </Typography>
                <LinearProgress
                  variant="determinate"
                  value={(validatePasswordStrength(password).score / 4) * 100}
                  sx={{ height: 8, borderRadius: 4 }}
                  color={
                    validatePasswordStrength(password).score >= 3
                      ? 'success'
                      : validatePasswordStrength(password).score >= 2
                        ? 'warning'
                        : 'error'
                  }
                />
              </Box>
            )}

            <TextField
              label="Confirm Password"
              type="password"
              fullWidth
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              error={confirmPassword !== '' && password !== confirmPassword}
              helperText={
                confirmPassword !== '' && password !== confirmPassword
                  ? 'Passwords do not match'
                  : ''
              }
              sx={{ mb: 3 }}
            />

            <Paper
              sx={theme => ({
                p: 2,
                backgroundColor: alpha(theme.palette.warning.main, 0.15),
                mb: 2,
              })}
            >
              <Box display="flex" alignItems="flex-start">
                <Checkbox
                  checked={understandsRisks}
                  onChange={e => setUnderstandsRisks(e.target.checked)}
                />
                <Typography variant="body2" sx={{ pt: 1 }}>
                  I understand that if I lose both my password and recovery phrase, my encrypted
                  data will be <strong>permanently inaccessible</strong>. I have saved my 24-word
                  recovery phrase in a secure location.
                </Typography>
              </Box>
            </Paper>

            <Box mt={3} display="flex" gap={2} justifyContent="flex-end">
              <Button onClick={handleBack}>Back</Button>
              <Button
                variant="contained"
                onClick={handleFinalizeEncryption}
                disabled={
                  !password ||
                  !confirmPassword ||
                  password !== confirmPassword ||
                  !validatePasswordStrength(password).valid ||
                  !understandsRisks ||
                  loading
                }
              >
                {loading ? 'Enabling Encryption...' : 'Enable Encryption'}
              </Button>
            </Box>
          </Box>
        );

      case 4:
        // Confirmation
        return (
          <Box textAlign="center">
            <CheckIcon sx={{ fontSize: 80, color: 'success.main', mb: 2 }} />
            <Typography variant="h5" gutterBottom>
              Encryption Enabled!
            </Typography>
            <Typography color="textSecondary" paragraph>
              End-to-end encryption has been successfully enabled for {organizationName}.
            </Typography>

            <Alert severity="success" sx={{ mt: 3, textAlign: 'left' }}>
              <AlertTitle>What's Next?</AlertTitle>
              <Typography variant="body2" component="div">
                <strong>1. Invite other leaders to encryption</strong>
                <br />
                Use the "Invite to Encryption" button to generate a one-time passphrase for each
                member who needs access. Share the passphrase via Discord DM or another secure
                channel.
                <br />
                <br />
                <strong>2. Start encrypting sensitive data</strong>
                <br />
                Operations, intelligence, and messages can now be encrypted end-to-end.
                <br />
                <br />
                <strong>3. Monitor access</strong>
                <br />
                View the encryption audit log and manage key holders from the Encryption Settings
                page.
              </Typography>
            </Alert>

            <Box mt={4}>
              <Button variant="contained" size="large" onClick={onComplete}>
                Go to Encryption Settings
              </Button>
            </Box>
          </Box>
        );

      default:
        return null;
    }
  };

  return (
    <Box>
      <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
        {steps.map(label => (
          <Step key={label}>
            <StepLabel>{label}</StepLabel>
          </Step>
        ))}
      </Stepper>

      {error && (
        <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {renderStepContent()}
    </Box>
  );
};
