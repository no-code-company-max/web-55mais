'use server';

import { createClient } from '@/lib/supabase/server';
import { resetSchema, passwordSchema } from '../schemas';

export type UpdatePasswordResult =
  | { ok: true }
  | {
      ok: false;
      reason:
        | 'no_session'
        | 'mismatch'
        | 'weak_password'
        | 'code_already_used'
        | 'error';
    };

// Called from the reset-password page AFTER the callback handler has
// exchanged the recovery `?code=` for a session. Requires that
// session; if absent (link expired, scanner pre-consumed it, etc.)
// we return `no_session` so the UI can prompt for a fresh recovery
// email. See plan G16/G25.
export async function updatePassword(input: unknown): Promise<UpdatePasswordResult> {
  // Pre-flight: weak password is more useful than a generic refine error
  // — surface it as its own reason so the form can show the right hint.
  if (
    typeof input === 'object' &&
    input !== null &&
    'password' in input &&
    !passwordSchema.safeParse((input as { password: unknown }).password).success
  ) {
    return { ok: false, reason: 'weak_password' };
  }

  const parsed = resetSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    if (issue?.path?.[0] === 'confirm') {
      return { ok: false, reason: 'mismatch' };
    }
    return { ok: false, reason: 'error' };
  }

  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { ok: false, reason: 'no_session' };

    const { error } = await supabase.auth.updateUser({
      password: parsed.data.password,
    });
    if (error) {
      const code = (error as { code?: string }).code;
      // Supabase signals an already-consumed recovery code with
      // 'invalid_otp' (the recovery token is a single-use OTP).
      if (
        code === 'invalid_otp' ||
        /invalid (recovery|otp)|token has expired/i.test(error.message ?? '')
      ) {
        return { ok: false, reason: 'code_already_used' };
      }
      return { ok: false, reason: 'error' };
    }

    return { ok: true };
  } catch {
    return { ok: false, reason: 'error' };
  }
}
