import { redirect } from 'next/navigation';
import {
  getTranslations,
  unstable_setRequestLocale,
} from 'next-intl/server';
import { createClient } from '@/lib/supabase/server';
import {
  AuthCard,
  ForgotPasswordForm,
  requestPasswordReset,
  safeNext,
} from '@/features/auth';

type Props = {
  params: { locale: string };
  searchParams: { next?: string };
};

// Forgot-password entry. Mirrors the login page structure:
// 1. Redirect-if-authed (G26) — a logged-in user has no business
//    requesting a recovery email; bounce to their next destination.
// 2. The form is anti-enumeration on its own (action always resolves
//    ok, UI always shows the same sent screen, G3); this page just
//    wires it up with the locale needed for emailRedirectTo.
export default async function ForgotPasswordPage({
  params: { locale },
  searchParams,
}: Props) {
  unstable_setRequestLocale(locale);

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect(safeNext(searchParams.next, locale));
  }

  const t = await getTranslations('Auth');

  return (
    <AuthCard title={t('forgot.title')} logoAlt={t('brand.logoAlt')}>
      <ForgotPasswordForm onSubmit={requestPasswordReset} locale={locale} />
    </AuthCard>
  );
}
