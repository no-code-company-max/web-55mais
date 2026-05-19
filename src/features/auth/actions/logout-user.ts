'use server';

import { createClient } from '@/lib/supabase/server';

export type LogoutResult = { ok: true } | { ok: false; reason: 'error' };

// Drops the Supabase session. Returns a typed result like the rest of
// the auth actions; the client decides where to send the user next
// (typically the public home for the current locale).
export async function logoutUser(): Promise<LogoutResult> {
  try {
    const supabase = createClient();
    const { error } = await supabase.auth.signOut();
    if (error) return { ok: false, reason: 'error' };
    return { ok: true };
  } catch {
    return { ok: false, reason: 'error' };
  }
}
