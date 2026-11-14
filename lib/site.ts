/**
 * Canonical site URL.
 *
 * Defaults to the production domain, but can be overridden at build time with
 * NEXT_PUBLIC_SITE_URL — useful for preview/staging deployments (e.g. Render)
 * where canonical tags, robots.txt and sitemap.xml should point at the real host.
 *
 * No trailing slash: consumers append paths directly (`${SITE_URL}/hospitals`).
 */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://www.jeevansetu.in').replace(/\/+$/, '');

export const SITE_NAME = 'JeevanSetu';

/** Absolute URL for a site-relative path. */
export function absoluteUrl(path = '/'): string {
  return `${SITE_URL}${path.startsWith('/') ? path : `/${path}`}`;
}
