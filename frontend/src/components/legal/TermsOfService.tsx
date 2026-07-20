/**
 * Terms of Service Component
 *
 * Displays the terms of service for Fringe Core / SC Fleet Manager
 */

import { Box, Divider, Typography } from '@mui/material';
import React from 'react';

export const TermsOfService: React.FC = () => {
  return (
    <Box sx={{ p: 3 }}>
      <Box>
        <Typography variant="h6">Terms of Service</Typography>
        <Typography sx={{ fontSize: '0.85rem', color: 'var(--spectrum-global-color-gray-600)' }}>
          Last Updated: March 21, 2026
        </Typography>
        <Divider sx={{ mt: 2, mb: 2 }} />

        <Box sx={{ maxHeight: '60vh', overflowY: 'auto', lineHeight: '1.6' }}>
          <Typography variant="subtitle1" mt={2} mb={1}>
            1. Acceptance of Terms
          </Typography>
          <Typography>
            By accessing and using Fringe Core (SC Fleet Manager), you accept and agree to be bound
            by the terms and provisions of this agreement. If you do not agree to these terms,
            please do not use this service.
          </Typography>

          <Typography variant="subtitle1" mt={3} mb={1}>
            2. Description of Service
          </Typography>
          <Typography>
            Fringe Core is a fleet management platform for Star Citizen organizations. The service
            provides tools for organization management, fleet coordination, activity planning, ship
            loadout management, crew operations, and community collaboration. This is a fan-made
            tool and is not affiliated with Cloud Imperium Games.
          </Typography>

          <Typography variant="subtitle1" mt={3} mb={1}>
            3. User Accounts
          </Typography>
          <Typography>
            You are responsible for maintaining the confidentiality of your account credentials and
            for all activities that occur under your account. You agree to notify us immediately of
            any unauthorized use of your account.
          </Typography>

          <Typography variant="subtitle1" mt={3} mb={1}>
            4. User Conduct
          </Typography>
          <Typography>You agree not to use the service to:</Typography>
          <Box sx={{ ml: 3, mt: 1 }}>
            <Typography>
              • Upload or transmit any unlawful, harmful, or offensive content
            </Typography>
            <Typography>• Violate any applicable laws or regulations</Typography>
            <Typography>• Interfere with or disrupt the service or servers</Typography>
            <Typography>
              • Attempt to gain unauthorized access to any portion of the service
            </Typography>
            <Typography>• Harass, abuse, or harm other users</Typography>
          </Box>

          <Typography variant="subtitle1" mt={3} mb={1}>
            5. Content Ownership
          </Typography>
          <Typography>
            You retain ownership of content you create or upload to the service. By uploading
            content, you grant us a license to use, store, and display that content as necessary to
            provide the service.
          </Typography>

          <Typography variant="subtitle1" mt={3} mb={1}>
            6. Intellectual Property
          </Typography>
          <Typography>
            The service and its original content, features, and functionality are owned by the
            Fringe Core development team and are protected by international copyright, trademark,
            and other intellectual property laws. Star Citizen, Roberts Space Industries, and
            related marks are trademarks and/or registered trademarks of Cloud Imperium Rights LLC
            and Cloud Imperium Games Corp.
          </Typography>

          <Typography variant="subtitle1" mt={3} mb={1}>
            7. Disclaimer of Warranties
          </Typography>
          <Typography>
            The service is provided "as is" and "as available" without any warranties of any kind,
            either express or implied. We do not warrant that the service will be uninterrupted,
            secure, or error-free.
          </Typography>

          <Typography variant="subtitle1" mt={3} mb={1}>
            8. Limitation of Liability
          </Typography>
          <Typography>
            To the maximum extent permitted by law, we shall not be liable for any indirect,
            incidental, special, consequential, or punitive damages resulting from your use or
            inability to use the service.
          </Typography>

          <Typography variant="subtitle1" mt={3} mb={1}>
            9. Termination
          </Typography>
          <Typography>
            We reserve the right to suspend or terminate your access to the service at any time,
            with or without notice, for conduct that we believe violates these terms or is harmful
            to other users or the service.
          </Typography>

          <Typography variant="subtitle1" mt={3} mb={1}>
            10. Changes to Terms
          </Typography>
          <Typography>
            We reserve the right to modify these terms at any time. We will notify users of any
            material changes by posting the new terms on this page. Your continued use of the
            service after such modifications constitutes your acceptance of the updated terms.
          </Typography>

          <Typography variant="subtitle1" mt={3} mb={1}>
            11. Third-Party Services
          </Typography>
          <Typography>
            The service integrates with third-party services including Discord, Azure Active
            Directory / Microsoft Entra, RSI authentication, Erkul.games (ship data), and
            SPViewer.eu (performance data). Your use of these services is subject to their
            respective terms and privacy policies.
          </Typography>

          <Typography variant="subtitle1" mt={3} mb={1}>
            12. Contact Information
          </Typography>
          <Typography>
            If you have any questions about these Terms of Service, please contact us through the
            support channels provided in the application.
          </Typography>

          <Divider sx={{ mt: 3, mb: 2 }} />
          <Typography sx={{ fontSize: '0.85rem', color: 'var(--spectrum-global-color-gray-600)' }}>
            By using Fringe Core, you acknowledge that you have read, understood, and agree to be
            bound by these terms.
          </Typography>
        </Box>
      </Box>
    </Box>
  );
};
