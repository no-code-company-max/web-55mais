import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// Auth callback handler — exchanges the Supabase `?code=` for a real
// session cookie, then redirects into the localized app. Lives at
// /auth/callback (FUERA del segmento [locale]) so the next-intl
// middleware doesn't reshape the URL or strip the query (plan C1).
// The locale travels as a query param, set by buildAuthCallbackUrl
// when we created the redirect; we whitelist it here.

const SUPPORTED_LOCALES = ['es', 'en', 'pt', 'fr', 'ca'] as const;
type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

function pickLocale(raw: string | null): SupportedLocale {
  return SUPPORTED_LOCALES.includes(raw as SupportedLocale)
    ? (raw as SupportedLocale)
    : 'es';
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get('code');
  const type = searchParams.get('type');
  const locale = pickLocale(searchParams.get('locale'));

  // No code → bounce to login with a generic message; the email link
  // was malformed or the user opened a stale tab.
  if (!code) {
    return NextResponse.redirect(
      new URL(`/${locale}/login?error=expired`, request.url),
    );
  }

  try {
    const supabase = createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      return NextResponse.redirect(
        new URL(`/${locale}/login?error=expired`, request.url),
      );
    }
  } catch {
    return NextResponse.redirect(
      new URL(`/${locale}/login?error=expired`, request.url),
    );
  }

  // Route by intent. signup → land in mi-cuenta (verified + logged
  // in); recovery → go set the new password; anything else → mi-cuenta.
  const dest =
    type === 'recovery'
      ? `/${locale}/recuperar/nueva-contrasena`
      : `/${locale}/mi-cuenta`;

  return NextResponse.redirect(new URL(dest, request.url));
}
