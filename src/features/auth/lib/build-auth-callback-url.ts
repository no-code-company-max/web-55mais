import { absoluteUrl } from '@/shared/lib/seo/site';

export type AuthCallbackType = 'signup' | 'recovery';

// Builds the absolute callback URL Supabase will redirect to from the
// email template. Lives outside the [locale] segment so the next-intl
// middleware doesn't reshape the request (the `?code=` query is
// sensitive — see plan G22 / C1). The locale travels as a query
// param and is whitelisted by the route handler.
export function buildAuthCallbackUrl(
  type: AuthCallbackType,
  locale: string,
): string {
  const params = new URLSearchParams({ type, locale });
  return absoluteUrl(`/auth/callback?${params.toString()}`);
}
