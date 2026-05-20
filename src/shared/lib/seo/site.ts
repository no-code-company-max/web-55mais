// Base URL for absolute links in sitemap, canonical, og:url. Override
// via NEXT_PUBLIC_SITE_URL. Falls back to the production domain.

const FALLBACK = 'https://55mas.es';

// `??` only falls back on null/undefined — a value set to "" in
// Vercel env config (an easy footgun) would otherwise become the base
// and crash `new URL()` at build time. Same for values pasted without
// a scheme. Both cases now degrade to the fallback rather than
// breaking the production build.
export function resolveBaseUrl(): string {
  const raw = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (!raw) return FALLBACK;
  const withoutTrailingSlash = raw.replace(/\/$/, '');
  if (!/^https?:\/\//i.test(withoutTrailingSlash)) return FALLBACK;
  return withoutTrailingSlash;
}

export const SITE_BASE_URL = resolveBaseUrl();

/** Build an absolute URL by joining the base with a path. */
export function absoluteUrl(path = ''): string {
  if (path.startsWith('http')) return path;
  return `${SITE_BASE_URL}${path.startsWith('/') ? '' : '/'}${path}`;
}
