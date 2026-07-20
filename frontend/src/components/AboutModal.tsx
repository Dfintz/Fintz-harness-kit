/**
 * AboutModal Component - Information about Fringe Core and 3rd party integrations
 */

import { alpha, useTheme } from '@mui/material';
import React from 'react';
import { Modal } from './ui/Modal';

export interface AboutModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AboutModal({ isOpen, onClose }: Readonly<AboutModalProps>): React.ReactElement {
  const theme = useTheme();

  const integrations = [
    {
      name: 'Ship Performance Viewer',
      url: 'https://www.spviewer.eu/',
      description: 'Ship performance data and detailed stats viewer',
    },
    {
      name: 'Cornerstone',
      url: 'https://finder.cstone.space/',
      description: 'Trade route finder and commodity tracker',
    },
    {
      name: 'UEX Corp',
      url: 'https://uexcorp.space/',
      description: 'Trading and market data platform',
    },
    {
      name: 'Erkul.games',
      url: 'https://www.erkul.games/',
      description: 'Ship loadout calculator and performance data',
    },
    {
      name: 'Sentry API',
      url: 'https://sentry.wildknightsquadron.com/api.html',
      description: 'Wild Knight Squadron API for game data',
    },
    {
      name: 'SCStats',
      url: 'https://github.com/Maple33-hash/SCStats',
      description: 'Desktop app for tracking Star Citizen gameplay statistics',
    },
    {
      name: 'VerseGuide',
      url: 'https://verseguide.com/',
      description:
        'Interactive Star Citizen location maps with terrain, POIs, and planetary coordinates for Stanton and Pyro systems',
    },
    {
      name: 'SnarePlan',
      url: 'https://snareplan.dolus.eu/',
      description:
        'Quantum interdiction route planner — calculate optimal QED-Snare positions for intercepting targets between locations',
    },
    {
      name: 'Ship Deck Maps',
      url: 'https://maps.adi.sc/',
      description:
        'Interactive ship deck maps and interior layouts for boarding operations and crew planning',
    },
  ];

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="About Fringe Core" size="lg">
      <div style={{ padding: '0 8px' }}>
        {/* Organization Info */}
        <div style={{ marginBottom: '32px' }}>
          <h3
            style={{
              color: theme.palette.primary.main,
              fontSize: '1.1rem',
              fontWeight: 700,
              marginBottom: '12px',
              letterSpacing: '0.5px',
            }}
          >
            Developed By
          </h3>
          <div
            style={{
              padding: '16px',
              background: alpha(theme.palette.background.paper, 0.6),
              borderRadius: '8px',
              border: `1px solid ${alpha(theme.palette.primary.main, 0.2)}`,
            }}
          >
            <div
              style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}
            >
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M12 2L2 7L12 12L22 7L12 2Z"
                  stroke={theme.palette.primary.main}
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M2 17L12 22L22 17"
                  stroke={theme.palette.primary.main}
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M2 12L12 17L22 12"
                  stroke={theme.palette.primary.main}
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <span
                style={{
                  color: theme.palette.common.white,
                  fontSize: '1.05rem',
                  fontWeight: 700,
                }}
              >
                Fringenauts Inc.
              </span>
            </div>
            <p
              style={{
                color: theme.palette.text.secondary,
                fontSize: '0.9rem',
                lineHeight: '1.6',
                marginBottom: '12px',
              }}
            >
              At the Edge, We Are Core - A Star Citizen organization pushing boundaries at the
              frontier of the verse.
            </p>
            <a
              href="https://robertsspaceindustries.com/orgs/FRINAUTS"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'inline-block',
                padding: '8px 16px',
                background: alpha(theme.palette.primary.main, 0.15),
                border: `1px solid ${alpha(theme.palette.primary.main, 0.4)}`,
                borderRadius: '6px',
                color: theme.palette.primary.main,
                fontSize: '0.875rem',
                fontWeight: 600,
                textDecoration: 'none',
                transition: theme.transitions.create('all', { duration: 200 }),
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = alpha(theme.palette.primary.main, 0.25);
                e.currentTarget.style.borderColor = theme.palette.primary.main;
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = alpha(theme.palette.primary.main, 0.15);
                e.currentTarget.style.borderColor = alpha(theme.palette.primary.main, 0.4);
              }}
            >
              Visit RSI Organization Page →
            </a>
          </div>
        </div>

        {/* Third-party Integrations */}
        <div>
          <h3
            style={{
              color: theme.palette.primary.main,
              fontSize: '1.1rem',
              fontWeight: 700,
              marginBottom: '12px',
              letterSpacing: '0.5px',
            }}
          >
            Third-Party Integrations
          </h3>
          <p
            style={{
              color: theme.palette.text.secondary,
              fontSize: '0.875rem',
              marginBottom: '16px',
              lineHeight: '1.5',
            }}
          >
            Fringe Core leverages these excellent community tools to enhance your Star Citizen
            experience:
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {integrations.map(integration => (
              <a
                key={integration.name}
                href={integration.url}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '12px',
                  padding: '14px',
                  background: alpha(theme.palette.background.paper, 0.5),
                  border: `1px solid ${alpha(theme.palette.divider, 0.4)}`,
                  borderRadius: '8px',
                  textDecoration: 'none',
                  transition: theme.transitions.create('all', { duration: 200 }),
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = alpha(theme.palette.primary.main, 0.1);
                  e.currentTarget.style.borderColor = alpha(theme.palette.primary.main, 0.3);
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = alpha(theme.palette.background.paper, 0.5);
                  e.currentTarget.style.borderColor = alpha(theme.palette.divider, 0.4);
                }}
              >
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 20 20"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  style={{ flexShrink: 0, marginTop: '2px' }}
                >
                  <path
                    d="M11 3L17 3L17 9"
                    stroke={theme.palette.primary.main}
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M17 3L10 10"
                    stroke={theme.palette.primary.main}
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M14 11V15C14 15.5304 13.7893 16.0391 13.4142 16.4142C13.0391 16.7893 12.5304 17 12 17H5C4.46957 17 3.96086 16.7893 3.58579 16.4142C3.21071 16.0391 3 15.5304 3 15V8C3 7.46957 3.21071 6.96086 3.58579 6.58579C3.96086 6.21071 4.46957 6 5 6H9"
                    stroke={theme.palette.primary.main}
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <div style={{ flex: 1 }}>
                  <div
                    style={{
                      color: theme.palette.common.white,
                      fontSize: '0.95rem',
                      fontWeight: 600,
                      marginBottom: '4px',
                    }}
                  >
                    {integration.name}
                  </div>
                  <div
                    style={{
                      color: theme.palette.text.secondary,
                      fontSize: '0.825rem',
                      lineHeight: '1.4',
                    }}
                  >
                    {integration.description}
                  </div>
                </div>
              </a>
            ))}
          </div>
        </div>

        {/* Support & Feedback */}
        <div style={{ marginTop: '28px' }}>
          <h3
            style={{
              color: theme.palette.primary.main,
              fontSize: '1.1rem',
              fontWeight: 700,
              marginBottom: '12px',
              letterSpacing: '0.5px',
            }}
          >
            Support &amp; Feedback
          </h3>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <a
              href="https://ko-fi.com/fringekofi"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 18px',
                background: alpha(theme.palette.error.main, 0.1),
                border: `1px solid ${alpha(theme.palette.error.main, 0.35)}`,
                borderRadius: '8px',
                color: theme.palette.error.light,
                fontSize: '0.875rem',
                fontWeight: 600,
                textDecoration: 'none',
                transition: theme.transitions.create('all', { duration: 200 }),
                outline: 'none',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = alpha(theme.palette.error.main, 0.2);
                e.currentTarget.style.borderColor = theme.palette.error.light;
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = alpha(theme.palette.error.main, 0.1);
                e.currentTarget.style.borderColor = alpha(theme.palette.error.main, 0.35);
              }}
              onFocus={e => {
                e.currentTarget.style.background = alpha(theme.palette.error.main, 0.2);
                e.currentTarget.style.borderColor = theme.palette.error.light;
                e.currentTarget.style.boxShadow = `0 0 0 2px ${alpha(theme.palette.error.main, 0.5)}`;
              }}
              onBlur={e => {
                e.currentTarget.style.background = alpha(theme.palette.error.main, 0.1);
                e.currentTarget.style.borderColor = alpha(theme.palette.error.main, 0.35);
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              {/* Ko-fi cup icon */}
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M23.881 8.948c-.773-4.085-4.859-4.593-4.859-4.593H.723c-.604 0-.679.798-.679.798s-.082 7.324-.022 11.822c.164 2.424 2.586 2.672 2.586 2.672s8.267-.023 11.966-.049c2.438-.426 2.683-2.566 2.658-3.734 4.352.24 7.422-2.831 6.649-6.916zm-11.062 3.511c-1.246 1.453-4.011 3.976-4.011 3.976s-.121.119-.31.023c-.076-.057-.108-.09-.108-.09-.443-.441-3.368-3.049-4.034-3.954-.709-.965-1.041-2.7-.091-3.71.951-1.01 3.005-1.086 4.363.407 0 0 1.565-1.782 3.468-.963 1.904.82 1.832 3.011.723 4.311zm6.173.478c-.928.116-1.682.028-1.682.028V7.284h1.77s1.971.551 1.971 2.638c0 1.913-.985 2.667-2.059 3.015z"
                  fill="currentColor"
                />
              </svg>
              Support on Ko-fi
            </a>
            <a
              href="https://discord.gg/EWavhFWq6p"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 18px',
                background: alpha(theme.palette.info.main, 0.1),
                border: `1px solid ${alpha(theme.palette.info.main, 0.35)}`,
                borderRadius: '8px',
                color: theme.palette.info.light,
                fontSize: '0.875rem',
                fontWeight: 600,
                textDecoration: 'none',
                transition: theme.transitions.create('all', { duration: 200 }),
                outline: 'none',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = alpha(theme.palette.info.main, 0.2);
                e.currentTarget.style.borderColor = theme.palette.info.light;
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = alpha(theme.palette.info.main, 0.1);
                e.currentTarget.style.borderColor = alpha(theme.palette.info.main, 0.35);
              }}
              onFocus={e => {
                e.currentTarget.style.background = alpha(theme.palette.info.main, 0.2);
                e.currentTarget.style.borderColor = theme.palette.info.light;
                e.currentTarget.style.boxShadow = `0 0 0 2px ${alpha(theme.palette.info.main, 0.5)}`;
              }}
              onBlur={e => {
                e.currentTarget.style.background = alpha(theme.palette.info.main, 0.1);
                e.currentTarget.style.borderColor = alpha(theme.palette.info.main, 0.35);
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              {/* Forum/discussion icon */}
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M21 15C21 15.5304 20.7893 16.0391 20.4142 16.4142C20.0391 16.7893 19.5304 17 19 17H7L3 21V5C3 4.46957 3.21071 3.96086 3.58579 3.58579C3.96086 3.21071 4.46957 3 5 3H19C19.5304 3 20.0391 3.21071 20.4142 3.58579C20.7893 3.96086 21 4.46957 21 5V15Z"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              Feedback &amp; Discussions
            </a>
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            marginTop: '24px',
            paddingTop: '20px',
            borderTop: `1px solid ${alpha(theme.palette.divider, 0.4)}`,
            textAlign: 'center',
          }}
        >
          <p
            style={{
              color: theme.palette.text.disabled,
              fontSize: '0.8rem',
              lineHeight: '1.5',
            }}
          >
            Fringe Core is an independent tool created by Star Citizen players, for Star Citizen
            players.
            <br />
            Not affiliated with Cloud Imperium Games or Roberts Space Industries.
          </p>
        </div>
      </div>
    </Modal>
  );
}
