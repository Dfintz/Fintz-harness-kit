/**
 * Privacy Policy Component
 *
 * Displays the privacy policy for Fringe Core / SC Fleet Manager
 */

import { Box, Divider, Typography } from '@mui/material';
import React from 'react';

export const PrivacyPolicy: React.FC = () => {
  return (
    <Box sx={{ p: 3 }}>
      <Box>
        <Typography variant="h6">Privacy Policy</Typography>
        <Typography sx={{ fontSize: '0.85rem', color: 'var(--spectrum-global-color-gray-600)' }}>
          Last Updated: March 21, 2026
        </Typography>
        <Divider sx={{ mt: 2, mb: 2 }} />

        <Box sx={{ maxHeight: '60vh', overflowY: 'auto', lineHeight: '1.6' }}>
          <Typography variant="subtitle1" mt={2} mb={1}>
            1. Information We Collect
          </Typography>
          <Typography mb={1}>
            We collect information that you provide directly to us, including:
          </Typography>
          <Box sx={{ ml: 3, mb: 2 }}>
            <Typography>• Account information (username, email, Discord ID)</Typography>
            <Typography>• Profile information (RSI handle, organization details)</Typography>
            <Typography>• User-generated content (fleet data, activity plans, messages)</Typography>
            <Typography>• Usage data (log files, IP addresses, browser information)</Typography>
          </Box>

          <Typography variant="subtitle1" mt={3} mb={1}>
            2. How We Use Your Information
          </Typography>
          <Typography mb={1}>We use the information we collect to:</Typography>
          <Box sx={{ ml: 3, mb: 2 }}>
            <Typography>• Provide, maintain, and improve our services</Typography>
            <Typography>• Process authentication and manage your account</Typography>
            <Typography>• Enable communication between users and organizations</Typography>
            <Typography>• Send you technical notices and support messages</Typography>
            <Typography>• Monitor and analyze usage patterns and trends</Typography>
            <Typography>• Detect, prevent, and address security issues</Typography>
          </Box>

          <Typography variant="subtitle1" mt={3} mb={1}>
            3. Information Sharing
          </Typography>
          <Typography>
            We do not sell your personal information. We may share your information only in the
            following circumstances:
          </Typography>
          <Box sx={{ ml: 3, mt: 1, mb: 2 }}>
            <Typography>• With your consent or at your direction</Typography>
            <Typography>
              • With organization administrators when you join their organization
            </Typography>
            <Typography>• To comply with legal obligations or respond to legal requests</Typography>
            <Typography>• To protect our rights, privacy, safety, or property</Typography>
          </Box>

          <Typography variant="subtitle1" mt={3} mb={1}>
            4. Third-Party Authentication
          </Typography>
          <Typography>
            We use third-party authentication services including Discord, Azure Active Directory /
            Microsoft Entra, and RSI. When you authenticate through these services, we receive
            limited profile information as authorized by you. We also fetch publicly available ship
            data from Erkul.games and performance data from SPViewer.eu. Please review the privacy
            policies of these services to understand how they handle your data.
          </Typography>

          <Typography variant="subtitle1" mt={3} mb={1}>
            5. Data Storage and Security
          </Typography>
          <Typography mb={1}>
            We implement comprehensive technical and organizational measures to protect your
            personal information:
          </Typography>
          <Box sx={{ ml: 3, mb: 2 }}>
            <Typography>
              • Secure servers hosted on Microsoft Azure with encryption at rest and in transit
            </Typography>
            <Typography>• Regular security audits and vulnerability assessments</Typography>
            <Typography>• Access controls and authentication mechanisms</Typography>
            <Typography>
              • Incident response procedures and breach notification protocols
            </Typography>
            <Typography>• Regular backups with secure storage</Typography>
          </Box>
          <Typography>
            However, no method of transmission over the Internet is 100% secure, and we cannot
            guarantee absolute security.
          </Typography>

          <Typography variant="subtitle1" mt={3} mb={1}>
            6. Data Retention
          </Typography>
          <Typography>
            We retain your personal information for as long as necessary to provide our services and
            fulfill the purposes described in this policy. You may request deletion of your account
            and associated data at any time through your privacy settings.
          </Typography>

          <Typography variant="subtitle1" mt={3} mb={1}>
            7. Your Rights and Choices
          </Typography>
          <Typography mb={1}>
            You have the following rights regarding your personal information:
          </Typography>
          <Box sx={{ ml: 3, mb: 2 }}>
            <Typography>• Access and review your personal information</Typography>
            <Typography>• Correct or update inaccurate information</Typography>
            <Typography>• Request deletion of your account and data</Typography>
            <Typography>• Withdraw consent for data processing</Typography>
            <Typography>• Export your data in a portable format</Typography>
            <Typography>• Opt out of non-essential communications</Typography>
          </Box>

          <Typography variant="subtitle1" mt={3} mb={1}>
            8. Cookies and Tracking
          </Typography>
          <Typography>
            We use cookies and similar tracking technologies to maintain your session, remember your
            preferences, and analyze usage patterns. You can control cookies through your browser
            settings, though some features may not function properly if cookies are disabled.
          </Typography>

          <Typography variant="subtitle1" mt={3} mb={1}>
            9. Children's Privacy
          </Typography>
          <Typography>
            Our service is not intended for users under the age of 13. We do not knowingly collect
            personal information from children under 13. If you believe we have collected such
            information, please contact us immediately.
          </Typography>

          <Typography variant="subtitle1" mt={3} mb={1}>
            10. International Data Transfers
          </Typography>
          <Typography>
            Your information may be transferred to and processed in countries other than your
            country of residence. These countries may have different data protection laws. By using
            our service, you consent to such transfers.
          </Typography>

          <Typography variant="subtitle1" mt={3} mb={1}>
            11. Zero Trust Security Approach
          </Typography>
          <Typography mb={1}>
            We implement a Zero Trust security model to protect your data:
          </Typography>
          <Box sx={{ ml: 3, mb: 2 }}>
            <Typography>
              • <strong>Verify explicitly:</strong> Always authenticate and authorize based on all
              available data points
            </Typography>
            <Typography>
              • <strong>Least privilege access:</strong> Limit user access with Just-In-Time and
              Just-Enough-Access (JIT/JEA)
            </Typography>
            <Typography>
              • <strong>Assume breach:</strong> Minimize blast radius and segment access, verify
              end-to-end encryption
            </Typography>
            <Typography>
              • <strong>Continuous monitoring:</strong> Real-time threat detection and anomaly
              analysis
            </Typography>
            <Typography>
              • <strong>Multi-factor authentication:</strong> Required for administrative access and
              sensitive operations
            </Typography>
          </Box>
          <Typography>
            This approach ensures that no entity, inside or outside our network, is automatically
            trusted.
          </Typography>

          <Typography variant="subtitle1" mt={3} mb={1}>
            12. Data Anonymization and Pseudonymization
          </Typography>
          <Typography mb={1}>
            We implement data anonymization and pseudonymization techniques to protect your privacy:
          </Typography>
          <Box sx={{ ml: 3, mb: 2 }}>
            <Typography>
              • <strong>Analytics data:</strong> Usage patterns are anonymized before analysis
            </Typography>
            <Typography>
              • <strong>Log files:</strong> Personal identifiers are pseudonymized or removed from
              logs after retention period
            </Typography>
            <Typography>
              • <strong>Research and development:</strong> Only anonymized data sets are used for
              testing and improvement
            </Typography>
            <Typography>
              • <strong>Data minimization:</strong> We collect only data necessary for service
              functionality
            </Typography>
            <Typography>
              • <strong>Automated deletion:</strong> Personal data is automatically anonymized or
              deleted when no longer needed
            </Typography>
          </Box>
          <Typography>
            Anonymized data cannot be re-identified and is not considered personal data under GDPR.
          </Typography>

          <Typography variant="subtitle1" mt={3} mb={1}>
            13. GDPR Compliance
          </Typography>
          <Typography mb={1}>
            For users in the European Economic Area (EEA), UK, and Switzerland, we comply with the
            General Data Protection Regulation (GDPR) and equivalent laws:
          </Typography>
          <Box sx={{ ml: 3, mb: 2 }}>
            <Typography>
              • <strong>Legal basis:</strong> We process data based on consent, contract necessity,
              legal obligations, or legitimate interests
            </Typography>
            <Typography>
              • <strong>Data Protection Officer:</strong> Available for privacy-related inquiries
              and concerns
            </Typography>
            <Typography>
              • <strong>Right to access:</strong> Request a copy of all personal data we hold about
              you
            </Typography>
            <Typography>
              • <strong>Right to rectification:</strong> Correct inaccurate or incomplete personal
              data
            </Typography>
            <Typography>
              • <strong>Right to erasure:</strong> Request deletion of your personal data ("right to
              be forgotten")
            </Typography>
            <Typography>
              • <strong>Right to restriction:</strong> Limit how we process your data in certain
              circumstances
            </Typography>
            <Typography>
              • <strong>Right to data portability:</strong> Receive your data in a structured,
              machine-readable format
            </Typography>
            <Typography>
              • <strong>Right to object:</strong> Object to processing based on legitimate interests
              or for direct marketing
            </Typography>
            <Typography>
              • <strong>Right to withdraw consent:</strong> Withdraw consent at any time where
              processing is based on consent
            </Typography>
            <Typography>
              • <strong>Right to lodge a complaint:</strong> File a complaint with your local data
              protection authority
            </Typography>
          </Box>
          <Typography mb={1}>
            <strong>Data transfers:</strong> When transferring data outside the EEA, we use Standard
            Contractual Clauses (SCCs) approved by the European Commission to ensure adequate
            protection.
          </Typography>
          <Typography>
            <strong>Breach notification:</strong> We will notify you and relevant authorities within
            72 hours of discovering a data breach that poses a risk to your rights and freedoms.
          </Typography>

          <Typography variant="subtitle1" mt={3} mb={1}>
            14. Changes to This Policy
          </Typography>
          <Typography>
            We may update this privacy policy from time to time. We will notify you of any material
            changes by posting the new policy on this page and updating the "Last Updated" date.
            Your continued use of the service after changes indicates your acceptance of the updated
            policy.
          </Typography>

          <Typography variant="subtitle1" mt={3} mb={1}>
            15. Contact Us
          </Typography>
          <Typography mb={1}>
            If you have any questions about this Privacy Policy or our data practices, please
            contact us:
          </Typography>
          <Box sx={{ ml: 3, mb: 2 }}>
            <Typography>• Through the support channels provided in the application</Typography>
            <Typography>• Via your privacy settings page</Typography>
            <Typography>
              • For GDPR inquiries: Contact our Data Protection Officer through the privacy settings
            </Typography>
          </Box>

          <Divider sx={{ mt: 3, mb: 2 }} />
          <Typography sx={{ fontSize: '0.85rem', color: 'var(--spectrum-global-color-gray-600)' }}>
            By using Fringe Core, you acknowledge that you have read and understood this Privacy
            Policy.
          </Typography>
        </Box>
      </Box>
    </Box>
  );
};
