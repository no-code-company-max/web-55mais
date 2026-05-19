'use server';

import { createClient } from '@/lib/supabase/server';
import { loginSchema } from '../schemas';

export type LoginResult =
  | { ok: true; data: { userId: string } }
  | {
      ok: false;
      reason: 'invalid_credentials' | 'email_not_confirmed' | 'error';
    };

// Wraps Supabase signInWithPassword behind the project's typed
// discriminated-result convention so callers get a uniform shape
// (mirrors getHireBootstrap). Failure is encoded, never thrown.
export async function loginUser(input: unknown): Promise<LoginResult> {
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) return { ok: false, reason: 'error' };

  try {
    const supabase = createClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email: parsed.data.email,
      password: parsed.data.password,
    });

    if (error || !data.user) {
      // Supabase exposes a distinct code for unconfirmed emails so we
      // can prompt the user to verify rather than show a misleading
      // "wrong password" message.
      if (
        (error as { code?: string } | null)?.code === 'email_not_confirmed' ||
        /not confirmed/i.test(error?.message ?? '')
      ) {
        return { ok: false, reason: 'email_not_confirmed' };
      }
      return { ok: false, reason: 'invalid_credentials' };
    }

    return { ok: true, data: { userId: data.user.id } };
  } catch {
    return { ok: false, reason: 'error' };
  }
}
