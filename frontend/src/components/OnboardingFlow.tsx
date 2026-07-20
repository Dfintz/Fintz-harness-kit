/**
 * Onboarding Flow Component
 *
 * Guides new users through the initial setup process:
 * 1. RSI Account Verification
 * 2. Add Ships to Personal Hangar
 * 3. Join or Create an Organization
 */

import { useUserShips } from '@/hooks/queries/useUserShipQueries';
import { useAuthStore } from '@/store/authStore';
import {
  Inventory2 as BoxIcon,
  CheckCircle as CheckmarkCircle,
  Groups as Organisations,
  PersonAdd as UserAdd,
} from '@mui/icons-material';
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogContent,
  DialogTitle,
  Divider,
  LinearProgress,
  Stack,
  Typography,
} from '@mui/material';
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Well } from './ui/Well';

interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  icon: React.ComponentType;
  completed: boolean;
  path?: string;
}

interface OnboardingFlowProps {
  isOpen: boolean;
  onClose: () => void;
}

export const OnboardingFlow: React.FC<OnboardingFlowProps> = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  const user = useAuthStore(state => state.user);
  const [currentStep, setCurrentStep] = useState(0);

  // Detect whether the user has any ships in their personal hangar so the
  // 'add-ships' step can render as completed. We only need a count — request
  // a single record to minimize payload. Errors are silently ignored: the
  // step remains incomplete, which is the safe default.
  const { data: shipsResult } = useUserShips({ limit: 1 });
  const hasShips = (shipsResult?.total ?? shipsResult?.items.length ?? 0) > 0;

  // Define onboarding steps
  const steps: OnboardingStep[] = [
    {
      id: 'verify-rsi',
      title: 'Verify RSI Account',
      description:
        'Link your Star Citizen account to unlock organization features and verify your identity.',
      icon: UserAdd,
      completed: !!user?.rsiVerified,
      path: '/profile',
    },
    {
      id: 'add-ships',
      title: 'Add Ships to Hangar',
      description:
        'Add your Star Citizen ships to your personal hangar. You can manage them independently or loan them to organizations later.',
      icon: BoxIcon,
      completed: hasShips,
      path: '/hangar',
    },
    {
      id: 'join-org',
      title: 'Join or Create Organization',
      description:
        'Browse public organizations to join, or create your own to start building your fleet command structure.',
      icon: Organisations,
      completed: !!user?.organizationId,
      path: '/directories',
    },
  ];

  const progress = ((currentStep + 1) / steps.length) * 100;

  const handleSkip = () => {
    onClose();
  };

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      // Final step - go to directories
      navigate('/directories');
      onClose();
    }
  };

  const handleGoToStep = (path?: string) => {
    if (path) {
      navigate(path);
      onClose();
    }
  };

  const currentStepData = steps[currentStep];

  return (
    <Dialog open={isOpen} onClose={onClose} maxWidth="sm" fullWidth disableRestoreFocus>
      <DialogTitle>Welcome to Fringe Core Fleet Manager!</DialogTitle>
      <Divider />
      <DialogContent sx={{ pt: 2 }}>
        {/* Progress Bar */}
        <Box mb={4}>
          <Stack direction="column" spacing={1}>
            <Stack justifyContent="space-between">
              <Typography>Setup Progress</Typography>
              <Typography>{Math.round(progress)}%</Typography>
            </Stack>
            <Box sx={{ width: '100%' }}>
              <LinearProgress
                variant="determinate"
                value={progress}
                aria-label="Onboarding Progress"
              />
            </Box>
          </Stack>
        </Box>

        {/* Step Indicators */}
        <Stack direction="row" spacing={2} mb={4} justifyContent="center">
          {steps.map((step, index) => (
            <Stack key={step.id} direction="column" alignItems="center" spacing={1}>
              <Box
                sx={{
                  width: 50,
                  height: 50,
                  borderRadius: '50%',
                  backgroundColor: (() => {
                    if (index === currentStep) return 'primary.main';
                    if (index < currentStep) return 'success.main';
                    return 'text.disabled';
                  })(),
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {index < currentStep ? (
                  <CheckmarkCircle sx={{ color: 'white', fontSize: 28 }} />
                ) : (
                  <Typography sx={{ color: 'white', fontWeight: 'bold' }}>{index + 1}</Typography>
                )}
              </Box>
              <Typography sx={{ fontSize: '0.8rem', textAlign: 'center', maxWidth: '100px' }}>
                {step.title}
              </Typography>
            </Stack>
          ))}
        </Stack>

        {/* Current Step Content */}
        <Well>
          <Stack direction="column" spacing={3} alignItems="center">
            <Box component={currentStepData.icon} sx={{ fontSize: 64 }} />
            <Typography variant="h6">{currentStepData.title}</Typography>
            <Typography>{currentStepData.description}</Typography>

            {/* Step-specific content */}
            {currentStep === 0 && (
              <Box width="100%">
                <Stack direction="column" spacing={2}>
                  <Chip
                    label="RSI verification proves you own your Star Citizen account"
                    variant="outlined"
                    color="info"
                  />
                  <Typography>To verify your RSI account:</Typography>
                  <Box component="ol" sx={{ paddingLeft: 2, ml: 2 }}>
                    <li>Go to your RSI profile settings</li>
                    <li>Add the verification code to your bio</li>
                    <li>Complete verification in your profile page</li>
                  </Box>
                  <Typography>
                    <strong>Note:</strong> You can still use most features without verification, but
                    verified accounts can create organizations.
                  </Typography>
                </Stack>
              </Box>
            )}

            {currentStep === 1 && (
              <Box width="100%">
                <Stack direction="column" spacing={2}>
                  <Chip
                    label="Your personal hangar is private and independent"
                    variant="outlined"
                    color="success"
                  />
                  <Typography>Ships in your personal hangar:</Typography>
                  <Box component="ul" sx={{ paddingLeft: 2, ml: 2 }}>
                    <li>Can be managed without joining an organization</li>
                    <li>Track insurance, modifications, and status</li>
                    <li>Optionally loan to org fleets when you join</li>
                  </Box>
                </Stack>
              </Box>
            )}

            {currentStep === 2 && (
              <Box width="100%">
                <Stack direction="column" spacing={2}>
                  <Chip
                    label="Organizations unlock fleet coordination features"
                    variant="outlined"
                  />
                  <Typography>Choose your path:</Typography>
                  <Box component="ul" sx={{ paddingLeft: 2, ml: 2 }}>
                    <li>
                      <strong>Join Existing:</strong> Browse public orgs and apply to join
                    </li>
                    <li>
                      <strong>Create New:</strong> Requires RSI-verified account
                    </li>
                    <li>
                      <strong>Stay Independent:</strong> You can always join later
                    </li>
                  </Box>
                  <Typography>
                    Organization membership enables fleet operations, shared resources, events, and
                    more.
                  </Typography>
                </Stack>
              </Box>
            )}

            {/* Action Button */}
            <Button variant="contained" onClick={handleGoToStep.bind(null, currentStepData.path)}>
              Go to {currentStepData.title}
            </Button>
          </Stack>
        </Well>
      </DialogContent>
      <Stack direction="row" spacing={2} sx={{ p: 2 }} justifyContent="flex-end">
        <Button variant="outlined" onClick={handleSkip}>
          Skip Tour
        </Button>
        <Button variant="contained" color="primary" onClick={handleNext}>
          {currentStep < steps.length - 1 ? 'Next' : 'Get Started'}
        </Button>
      </Stack>
    </Dialog>
  );
};
