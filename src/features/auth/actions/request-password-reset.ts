'use server';

import { createClient } from '@/lib/supabase/server';
import { forgotSchema } from '../schemas';
import { buildAuthCallbackUrl } from '../lib/build-auth-callback-url';

export type RequestPasswordResetResult = { ok: true };

type Input = { email: string; locale: string };

// Anti email-enumeration: the response is ALWAYS ok, regardless of
// whether the email exists, whether Supabase rate-limits, or anything
// else. Without this, attackers can distinguish registered vs
// unregistered emails by error responses or timing (rate-limit only
// fires for known emails). See plan C3/G3.
//
// Note: enumeration via the public RPC `is_email_registered` is still
// possible (G24); this layer eliminates leaks from THIS surface only.
export async function requestPasswordReset(
  input: Input,
): Promise<RequestPasswordResetResult> {
  const parsed = forgotSchema.safeParse({ email: input.email });
  if (!parsed.success) return { ok: true };

  try {
    const supabase = createClient();
    await supabase.auth.resetPasswordForEmail(parsed.data.email, {
      redirectTo: buildAuthCallbackUrl('recovery', input.locale),
    });
  } catch {
    // Swallow — never leak existence via thrown errors.
  }

  return { ok: true };
}
