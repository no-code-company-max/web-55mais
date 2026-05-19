import { redirect } from 'next/navigation';
import {
  getTranslations,
  unstable_setRequestLocale,
} from 'next-intl/server';
import { createClient } from '@/lib/supabase/server';
import {
  AuthCard,
  ResetPasswordForm,
  updatePassword,
  safeNext,
} from '@/features/auth';

type Props = {
  params: { locale: string };
  searchParams: { next?: string };
};

// Reset-password surface. Session-gated because the callback handler
// is responsible for exchanging the recovery ?code= for a session
// before this page renders. If we land here without a session, the
// link expired, was already consumed by an email scanner (G25), or the
// user navigated here manually — send them back to /recuperar with an
// expired hint so they request a fresh email instead of staring at a
// form that will only fail on submit.
export default async function ResetPasswordPage({
  params: { locale },
  searchParams,
}: Props) {
  unstable_setRequestLocale(locale);

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/${locale}/recuperar?error=expired`);
  }

  const nextPath = safeNext(searchParams.next, locale);
  const t = await getTranslations('Auth');

  return (
    <AuthCard
      title={t('reset.title')}
      logoAlt={t('brand.logoAlt')}
    >
      <ResetPasswordForm onSubmit={updatePassword} nextPath={nextPath} />
    </AuthCard>
  );
}
