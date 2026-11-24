/**
 * Central registry of AdSense ad unit slot IDs.
 *
 * These are PLACEHOLDERS. Create the actual ad units in your AdSense
 * dashboard (adsense.google.com, under Ads > By ad unit > create) under
 * publisher ca-pub-2881807085062922, then replace each value below with
 * the real slot ID AdSense gives you. Ads will not serve with placeholder
 * slot IDs — AdSense will simply show blank space or a console warning
 * until real slots are in place, and new sites also need to be reviewed
 * and approved by AdSense before any ads render at all.
 */
export const AD_SLOTS = {
  /** Sidebar unit on the dashboard, next to the main feed. */
  dashboardSidebar: '0000000001',
  /** In-feed unit inserted between blog list items. */
  blogsFeed: '0000000002',
  /** In-article unit inside a blog post's body. */
  blogInArticle: '0000000003',
  /** Banner near the bottom of the landing page, above the footer. */
  landingBanner: '0000000004',
} as const;
