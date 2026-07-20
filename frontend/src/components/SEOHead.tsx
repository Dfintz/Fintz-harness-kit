/**
 * SEO Head Component
 *
 * Reusable helmet wrapper for setting page-level meta tags,
 * Open Graph, and Twitter Card metadata.
 *
 * @module components/SEOHead
 */

import React from 'react';
import { Helmet } from 'react-helmet-async';

interface SEOHeadProps {
  title?: string;
  description?: string;
  /** Canonical URL for the page */
  canonical?: string;
  /** Open Graph image URL */
  ogImage?: string;
  /** Open Graph type (default: 'website') */
  ogType?: string;
  /** Twitter card type (default: 'summary_large_image') */
  twitterCard?: 'summary' | 'summary_large_image';
  /** Additional keywords */
  keywords?: string[];
  /** Don't index this page */
  noIndex?: boolean;
  /** JSON-LD structured data object(s) — rendered as <script type="application/ld+json"> */
  jsonLd?: Record<string, unknown> | Record<string, unknown>[];
}

const SITE_NAME = 'Fringe Core — Star Citizen Fleet Manager';
const DEFAULT_DESCRIPTION =
  'The enterprise-grade fleet management platform for Star Citizen organizations. ' +
  'Real-time fleet tracking, org management, bounty boards, trade logistics, ' +
  'and Discord integration — all in one place.';

export const SEOHead: React.FC<SEOHeadProps> = ({
  title,
  description = DEFAULT_DESCRIPTION,
  canonical,
  ogImage,
  ogType = 'website',
  twitterCard = 'summary_large_image',
  keywords = [],
  noIndex = false,
  jsonLd,
}) => {
  const pageTitle = title ? `${title} | Fringe Core` : SITE_NAME;

  const defaultKeywords = [
    'Star Citizen',
    'fleet manager',
    'organization',
    'org management',
    'fleet tracking',
    'bounty board',
    'trade logistics',
    'Discord bot',
    'Fringe Core',
  ];

  const allKeywords = [...defaultKeywords, ...keywords].join(', ');

  return (
    <Helmet>
      {/* Primary */}
      <title>{pageTitle}</title>
      <meta name="description" content={description} />
      <meta name="keywords" content={allKeywords} />
      {/* Robots */}
      {noIndex && <meta name="robots" content="noindex, nofollow" />}
      {/* Canonical */}
      {canonical && <link rel="canonical" href={canonical} />}
      {/* Open Graph */}
      <meta property="og:title" content={pageTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:type" content={ogType} />
      <meta property="og:site_name" content="Fringe Core" />
      {canonical && <meta property="og:url" content={canonical} />}
      {ogImage && <meta property="og:image" content={ogImage} />}
      {/* Twitter Card */}
      <meta name="twitter:card" content={twitterCard} />
      <meta name="twitter:title" content={pageTitle} />
      <meta name="twitter:description" content={description} />
      {ogImage && <meta name="twitter:image" content={ogImage} />}
      {/* Theme — progressive enhancement, unsupported browsers simply ignore it */}
      <meta name="theme-color" content="#0a1628" /> {/* NOSONAR */}
      {/* JSON-LD Structured Data */}
      {jsonLd &&
        (Array.isArray(jsonLd) ? jsonLd : [jsonLd]).map(data => (
          <script key={JSON.stringify(data['@type'] || 'ld')} type="application/ld+json">
            {JSON.stringify(data)}
          </script>
        ))}
    </Helmet>
  );
};
