import { describe, it, expect, vi, beforeEach } from 'vitest';

const signOutMock = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  createClient: () => ({ auth: { signOut: signOutMock } }),
}));

import { logoutUser } from '../logout-user';

describe('logoutUser', () => {
  beforeEach(() => signOutMock.mockReset());

  it('returns ok on successful sign out', async () => {
    signOutMock.mockResolvedValue({ error: null });
    const result = await logoutUser();
    expect(result).toEqual({ ok: true });
    expect(signOutMock).toHaveBeenCalledTimes(1);
  });

  it('returns error reason when Supabase returns an error', async () => {
    signOutMock.mockResolvedValue({ error: { message: 'boom' } });
    const result = await logoutUser();
    expect(result).toEqual({ ok: false, reason: 'error' });
  });

  it('returns error reason when Supabase throws', async () => {
    signOutMock.mockImplementationOnce(() => {
      const p = Promise.reject(new Error('network'));
      p.catch(() => {});
      return p;
    });
    const result = await logoutUser();
    expect(result).toEqual({ ok: false, reason: 'error' });
  });
});
