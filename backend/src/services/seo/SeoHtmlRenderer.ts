import type { SEOMetadata } from './SeoService';

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function renderSeoHtmlDocument(meta: SEOMetadata): string {
  const title = escapeHtml(meta.title);
  const description = escapeHtml(meta.description);
  const canonicalUrl = escapeHtml(meta.canonicalUrl);
  const ogTitle = escapeHtml(meta.openGraph.title);
  const ogDescription = escapeHtml(meta.openGraph.description);
  const ogType = escapeHtml(meta.openGraph.type);
  const ogUrl = escapeHtml(meta.openGraph.url);
  const ogSiteName = escapeHtml(meta.openGraph.siteName);
  const ogImage = meta.openGraph.image ? escapeHtml(meta.openGraph.image) : '';
  const twitterCard = escapeHtml(meta.twitterCard.card);
  const twitterTitle = escapeHtml(meta.twitterCard.title);
  const twitterDescription = escapeHtml(meta.twitterCard.description);
  const twitterImage = meta.twitterCard.image ? escapeHtml(meta.twitterCard.image) : '';
  const jsonLd = escapeHtml(JSON.stringify(meta.jsonLd));

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${title}</title>
    <meta name="description" content="${description}" />
    <link rel="canonical" href="${canonicalUrl}" />
    <meta property="og:title" content="${ogTitle}" />
    <meta property="og:description" content="${ogDescription}" />
    <meta property="og:type" content="${ogType}" />
    <meta property="og:url" content="${ogUrl}" />
    <meta property="og:site_name" content="${ogSiteName}" />
    ${ogImage ? `<meta property="og:image" content="${ogImage}" />` : ''}
    <meta name="twitter:card" content="${twitterCard}" />
    <meta name="twitter:title" content="${twitterTitle}" />
    <meta name="twitter:description" content="${twitterDescription}" />
    ${twitterImage ? `<meta name="twitter:image" content="${twitterImage}" />` : ''}
    <script type="application/ld+json">${jsonLd}</script>
  </head>
  <body>
    <p>Social preview metadata response.</p>
  </body>
</html>`;
}

