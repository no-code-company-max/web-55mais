'use server';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { registerSchema } from '../schemas';
import { buildAuthCallbackUrl } from '../lib/build-auth-callback-url';

export type RegisterUserResult =
  | { ok: true; data: { userId: string } }
  | {
      ok: false;
      reason:
        | 'email_already_registered'
        | 'weak_password'
        | 'invalid_email'
        | 'error';
    };

type Input = {
  full_name: string;
  phone: string;
  preferred_country: string;
  preferred_city: string;
  email: string;
  password: string;
  locale: string;
};

// Creates a base user account: auth.users via signUp + the trigger-
// seeded profiles row gets phone/preferred_country/preferred_city
// patched via the ADMIN client (service-role). Does NOT create a
// client_profile or talent_profile — the user is "base" (per the
// additive role model: they can become client/talent later).
//
// Email confirmation is ON: signUp returns session: null, the user
// receives an email, clicks the link → /auth/callback?type=signup
// exchanges the code for a session and lands on /mi-cuenta. Until
// then we still need to persist the extra profile fields; the anon
// client wouldn't have auth.uid() at this stage, so the admin client
// is the right tool (matches signupClient in service-hire).
export async function registerUser(input: unknown): Promise<RegisterUserResult> {
  const parsed = registerSchema.safeParse(input);
  if (!parsed.success) return { ok: false, reason: 'error' };

  const data = parsed.data;
  const locale = (input as Input).locale ?? 'es';

  try {
    const supabase = createClient();
    const { data: signUpRes, error: signUpErr } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
      options: {
        data: { full_name: data.full_name },
        emailRedirectTo: buildAuthCallbackUrl('signup', locale),
      },
    });

    if (signUpErr || !signUpRes.user) {
      const msg = signUpErr?.message ?? '';
      const code = (signUpErr as { code?: string } | null | undefined)?.code;
      if (
        code === 'user_already_exists' ||
        /already registered|already exists/i.test(msg)
      ) {
        return { ok: false, reason: 'email_already_registered' };
      }
      if (code === 'weak_password' || /password/i.test(msg)) {
        return { ok: false, reason: 'weak_password' };
      }
      if (code === 'validation_failed' || /email/i.test(msg)) {
        return { ok: false, reason: 'invalid_email' };
      }
      return { ok: false, reason: 'error' };
    }

    // Patch the profile (trigger created it with full_name; we add the
    // rest). Admin client because session is null with email-confirm
    // ON; auth.uid() would be empty under the anon client.
    const admin = createAdminClient();
    const { error: profErr } = await admin
      .from('profiles')
      .update({
        phone: data.phone,
        preferred_country: data.preferred_country,
        preferred_city: data.preferred_city,
      })
      .eq('id', signUpRes.user.id);

    if (profErr) return { ok: false, reason: 'error' };

    return { ok: true, data: { userId: signUpRes.user.id } };
  } catch {
    return { ok: false, reason: 'error' };
  }
}
