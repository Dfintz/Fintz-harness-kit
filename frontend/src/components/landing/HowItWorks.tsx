/**
 * How It Works
 *
 * 3-step flow section for the landing page.
 */

import DashboardCustomizeIcon from '@mui/icons-material/DashboardCustomize';
import GroupAddIcon from '@mui/icons-material/GroupAdd';
import PeopleAltIcon from '@mui/icons-material/PeopleAlt';
import { Box, Container, Grid, Stack, Typography } from '@mui/material';
import React from 'react';

import { scColors } from '@/components/ui/tokens';

interface StepProps {
  number: number;
  icon: React.ReactNode;
  title: string;
  description: string;
  color: string;
}

const steps: Omit<StepProps, 'number'>[] = [
  {
    icon: <GroupAddIcon sx={{ fontSize: 36 }} />,
    title: 'Create Your Org',
    description:
      'Set up your organization in minutes. Import your RSI org, configure roles and permissions, and invite your members.',
    color: scColors.cyan[500],
  },
  {
    icon: <PeopleAltIcon sx={{ fontSize: 36 }} />,
    title: 'Build Your Team',
    description:
      'Members link their RSI accounts, import ships, and get assigned roles. Discord bot keeps everyone in sync.',
    color: scColors.secondary,
  },
  {
    icon: <DashboardCustomizeIcon sx={{ fontSize: 36 }} />,
    title: 'Command & Conquer',
    description:
      'Schedule operations, manage fleets, post bounties, run trade routes, and track performance — all in one place.',
    color: scColors.success,
  },
];

const Step: React.FC<StepProps> = ({ number, icon, title, description, color }) => (
  <Stack alignItems="center" textAlign="center" spacing={2}>
    {/* Step number ring */}
    <Box
      sx={{
        position: 'relative',
        width: 80,
        height: 80,
        borderRadius: '50%',
        border: `2px solid ${color}40`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color,
        background: `${color}10`,
      }}
    >
      {icon}
      {/* Number badge */}
      <Box
        sx={{
          position: 'absolute',
          top: -4,
          right: -4,
          width: 24,
          height: 24,
          borderRadius: '50%',
          background: color,
          color: 'background.default',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '0.75rem',
          fontWeight: 700,
        }}
      >
        {number}
      </Box>
    </Box>
    <Typography variant="h6" sx={{ fontWeight: 600, color: 'text.primary' }}>
      {title}
    </Typography>
    <Typography variant="body2" sx={{ color: 'text.secondary', maxWidth: 280, lineHeight: 1.6 }}>
      {description}
    </Typography>
  </Stack>
);

export const HowItWorks: React.FC = () => {
  return (
    <Box id="how-it-works" sx={{ py: { xs: 8, md: 12 } }}>
      <Container maxWidth="lg">
        <Typography
          variant="h3"
          sx={{
            textAlign: 'center',
            fontWeight: 700,
            mb: 2,
            color: 'text.primary',
            fontSize: { xs: '1.75rem', md: '2.5rem' },
          }}
        >
          Up and Running in Minutes
        </Typography>
        <Typography
          variant="body1"
          sx={{ textAlign: 'center', color: 'text.secondary', mb: 8, maxWidth: 500, mx: 'auto' }}
        >
          Three steps to transform how your org operates.
        </Typography>

        <Grid container spacing={6} justifyContent="center">
          {steps.map((step, index) => (
            <Grid size={{ xs: 12, sm: 4 }} key={step.title}>
              <Step number={index + 1} {...step} />
            </Grid>
          ))}
        </Grid>
      </Container>
    </Box>
  );
};
