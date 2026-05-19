import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// Logic for /auth/callback. Lives under features/auth so the route
// file at src/app/auth/callback/route.ts is a one-line shell — keeps
// the boundaries (features can't import app) and lets the integration
// suite cover it. Locale travels as a query param (plan C1/G22) and
// is whitelisted here.

const SUPPORTED_LOCALES = ['es', 'en', 'pt', 'fr', 'ca'] as const;
type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

function pickLocale(raw: string | null): SupportedLocale {
  return SUPPORTED_LOCALES.includes(raw as SupportedLocale)
    ? (raw as SupportedLocale)
    : 'es';
}

export async function handleAuthCallback(
  request: NextRequest,
): Promise<NextResponse> {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get('code');
  const type = searchParams.get('type');
  const locale = pickLocale(searchParams.get('locale'));

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

  const dest =
    type === 'recovery'
      ? `/${locale}/recuperar/nueva-contrasena`
      : `/${locale}/mi-cuenta`;

  return NextResponse.redirect(new URL(dest, request.url));
}
