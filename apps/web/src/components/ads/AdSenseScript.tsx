'use client';

import Script from 'next/script';

export const ADSENSE_CLIENT_ID = 'ca-pub-2881807085062922';

/**
 * Loads the Google AdSense script once for the whole site. Mount this in the
 * root layout. Individual placements are rendered with <AdUnit />.
 */
export function AdSenseScript() {
  return (
    <Script
      async
      src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT_ID}`}
      crossOrigin="anonymous"
      strategy="afterInteractive"
    />
  );
}
