'use client';

import { useEffect, useRef } from 'react';
import { logger } from '@/lib/logger';

const ADSENSE_CLIENT_ID = 'ca-pub-2881807085062922';

declare global {
  interface Window {
    adsbygoogle: unknown[];
  }
}

export interface AdUnitProps {
  /** Ad unit slot ID from the AdSense dashboard. Create ad units there and paste the slot ID here. */
  slot: string;
  /** 'auto' fluid responsive display ad, 'in-article' for a native in-content unit, 'in-feed' for feed-style placement. */
  format?: 'auto' | 'in-article' | 'in-feed' | 'fluid';
  layout?: string;
  layoutKey?: string;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Renders a single Google AdSense unit. Wrap ad-heavy pages sparingly —
 * 2-3 units per page is a reasonable ceiling for both UX and AdSense policy
 * compliance. Each <AdUnit> pushes itself to the adsbygoogle queue once,
 * on mount.
 */
export function AdUnit({ slot, format = 'auto', layout, layoutKey, className, style }: AdUnitProps) {
  const insRef = useRef<HTMLModElement>(null);
  const pushed = useRef(false);

  useEffect(() => {
    if (pushed.current) return;
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
      pushed.current = true;
    } catch (err) {
      // AdSense script may not have loaded yet (e.g. blocked by an ad blocker,
      // or still fetching) — fail silently rather than breaking the page.
      logger.warn('AdSense push failed:', err);
    }
  }, []);

  return (
    <ins
      ref={insRef}
      className={`adsbygoogle ${className ?? ''}`}
      style={{ display: 'block', ...style }}
      data-ad-client={ADSENSE_CLIENT_ID}
      data-ad-slot={slot}
      data-ad-format={format}
      data-full-width-responsive="true"
      {...(layout ? { 'data-ad-layout': layout } : {})}
      {...(layoutKey ? { 'data-ad-layout-key': layoutKey } : {})}
    />
  );
}
