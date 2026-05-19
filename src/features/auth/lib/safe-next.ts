// Validates the `?next=` query param to prevent open-redirect attacks.
// Accepts only internal paths; rejects protocol-relative URLs,
// absolute external URLs, javascript: URIs, backslash-escaped paths,
// and internal prefixes that shouldn't be navigation targets
// (route handlers, framework assets, the auth surface itself).

const BLOCKLIST_PREFIXES = ['/api/', '/_next/', '/_vercel/', '/auth/'];

export function safeNext(
  value: string | null | undefined,
  locale: string,
): string {
  const fallback = `/${locale}/mi-cuenta`;

  if (!value) return fallback;
  if (value.includes('\\')) return fallback;
  if (!value.startsWith('/')) return fallback;
  // `//evil.com` is a protocol-relative URL — same risk as absolute.
  if (value.startsWith('//')) return fallback;

  // Some agents normalise multiple slashes; reject the second char too.
  for (const prefix of BLOCKLIST_PREFIXES) {
    if (value === prefix.slice(0, -1) || value.startsWith(prefix)) {
      return fallback;
    }
  }

  return value;
}
