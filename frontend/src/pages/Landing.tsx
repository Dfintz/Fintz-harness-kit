/**
 * Landing Page
 *
 * Public marketing page for unauthenticated visitors.
 * Showcases features, live stats, and CTAs.
 */

import { ChangelogPreview } from '@/components/landing/ChangelogPreview';
import { CTAFooter } from '@/components/landing/CTAFooter';
import { DiscordBotPreview } from '@/components/landing/DiscordBotPreview';
import { FeatureShowcase } from '@/components/landing/FeatureShowcase';
import { HeroSection } from '@/components/landing/HeroSection';
import { HowItWorks } from '@/components/landing/HowItWorks';
import { MobileAppPreview } from '@/components/landing/MobileAppPreview';
import { StatsBar } from '@/components/landing/StatsBar';
import { SEOHead } from '@/components/SEOHead';
import { usePrefersReducedMotion } from '@/components/ui/accessibility/useA11y';
import { Box } from '@mui/material';
import React, { useEffect, useMemo } from 'react';
import { useLocation } from 'react-router-dom';

/** JSON-LD structured data for the landing page */
function useLandingJsonLd() {
  return useMemo(
    () => [
      {
        '@context': 'https://schema.org',
        '@type': 'WebApplication',
        name: 'Fringe Core',
        url: 'https://fringecore.space',
        description:
          'The all-in-one platform for Star Citizen organizations. Fleet tracking, bounty boards, tactical briefings, trade logistics, Discord bot, org management, and real-time collaboration.',
        applicationCategory: 'GameApplication',
        operatingSystem: 'Web',
        offers: {
          '@type': 'Offer',
          price: '0',
          priceCurrency: 'USD',
        },
        featureList: [
          'Real-time fleet tracking',
          'Organization management',
          'Bounty boards & hunter profiles',
          'Trade logistics with live pricing',
          'Discord bot with 32 commands',
          'Tactical briefings & operation planning',
          'Activities, events & calendar',
          'Analytics, reputation & leaderboards',
          'RSI account verification & sync',
          'Alliance & federation management',
          'Custom titles & badges',
          'Moderation & member audit',
          'GDPR compliant & zero-trust security',
        ],
      },
      {
        '@context': 'https://schema.org',
        '@type': 'Organization',
        name: 'Fringe Core',
        url: 'https://fringecore.space',
        logo: 'https://fringecore.space/fringecore.png',
        sameAs: [],
      },
    ],
    []
  );
}

export const Landing: React.FC = () => {
  const location = useLocation();
  const prefersReducedMotion = usePrefersReducedMotion();
  const jsonLd = useLandingJsonLd();

  // Handle hash navigation for anchor links
  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    if (location.hash) {
      const id = location.hash.replace('#', '');
      const element = document.getElementById(id);
      if (element) {
        // Use setTimeout to ensure DOM is ready
        timeoutId = globalThis.setTimeout(() => {
          element.scrollIntoView({
            behavior: prefersReducedMotion ? 'auto' : 'smooth',
            block: 'start',
          });
        }, 100);
      }
    }

    return () => {
      if (timeoutId !== undefined) {
        globalThis.clearTimeout(timeoutId);
      }
    };
  }, [location.hash, prefersReducedMotion]);

  return (
    <Box>
      <SEOHead
        title="Fleet Management for Star Citizen Orgs"
        description="The all-in-one platform for Star Citizen organizations. Fleet tracking, bounty boards, tactical briefings, trade logistics, Discord bot, org management, and real-time collaboration."
        canonical="https://fringecore.space/"
        jsonLd={jsonLd}
      />
      <HeroSection />
      <StatsBar />
      <FeatureShowcase />
      <HowItWorks />
      <DiscordBotPreview />
      <MobileAppPreview />
      <ChangelogPreview />
      <CTAFooter />
    </Box>
  );
};
