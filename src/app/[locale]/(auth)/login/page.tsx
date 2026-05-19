import { redirect } from 'next/navigation';
import {
  getTranslations,
  unstable_setRequestLocale,
} from 'next-intl/server';
import { createClient } from '@/lib/supabase/server';
import { AuthCard, LoginForm, loginUser, safeNext } from '@/features/auth';

type Props = {
  params: { locale: string };
  searchParams: { next?: string; error?: string };
};

// Server-rendered login surface. Three responsibilities:
// 1. Redirect-if-authed (G26) so a signed-in visitor never sees the form
//    again and any ?next= hint is honored on the round-trip.
// 2. Validate ?next= through safeNext before handing it to the client form
//    (defence-in-depth: the client also receives an already-sanitised path).
// 3. Surface ?error=expired set by the auth callback handler when a code
//    failed exchange (callback always redirects here with `expired`).
export default async function LoginPage({
  params: { locale },
  searchParams,
}: Props) {
  unstable_setRequestLocale(locale);

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const nextPath = safeNext(searchParams.next, locale);

  if (user) {
    redirect(nextPath);
  }

  const t = await getTranslations('Auth');
  const initialError = searchParams.error === 'expired' ? 'expired' : null;

  return (
    <AuthCard title={t('login.title')} logoAlt={t('brand.logoAlt')}>
      <LoginForm
        onSubmit={loginUser}
        locale={locale}
        nextPath={nextPath}
        initialError={initialError}
      />
    </AuthCard>
  );
}
