import { describe, it, expect, vi, beforeEach } from 'vitest';

const signInMock = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  createClient: () => ({ auth: { signInWithPassword: signInMock } }),
}));

import { loginUser } from '../login-user';

describe('loginUser', () => {
  beforeEach(() => signInMock.mockReset());

  it('returns ok with userId on successful sign-in', async () => {
    signInMock.mockResolvedValue({
      data: { user: { id: 'user-1' } },
      error: null,
    });
    const result = await loginUser({
      email: 'a@b.com',
      password: 'whatever',
    });
    expect(result).toEqual({ ok: true, data: { userId: 'user-1' } });
    expect(signInMock).toHaveBeenCalledWith({
      email: 'a@b.com',
      password: 'whatever',
    });
  });

  it('normalizes email (trim + lowercase) before calling Supabase', async () => {
    signInMock.mockResolvedValue({
      data: { user: { id: 'u' } },
      error: null,
    });
    await loginUser({ email: '  User@Example.COM ', password: 'x' });
    expect(signInMock).toHaveBeenCalledWith({
      email: 'user@example.com',
      password: 'x',
    });
  });

  it('returns invalid_credentials on auth error', async () => {
    signInMock.mockResolvedValue({
      data: { user: null },
      error: { message: 'Invalid login credentials' },
    });
    const result = await loginUser({ email: 'a@b.com', password: 'x' });
    expect(result).toEqual({ ok: false, reason: 'invalid_credentials' });
  });

  it('returns email_not_confirmed when Supabase says so', async () => {
    signInMock.mockResolvedValue({
      data: { user: null },
      error: {
        message: 'Email not confirmed',
        code: 'email_not_confirmed',
      },
    });
    const result = await loginUser({ email: 'a@b.com', password: 'x' });
    expect(result).toEqual({ ok: false, reason: 'email_not_confirmed' });
  });

  it('returns error on schema invalid', async () => {
    const result = await loginUser({
      email: 'not-an-email',
      password: 'x',
    });
    expect(result).toEqual({ ok: false, reason: 'error' });
  });

  it('returns invalid_credentials on unknown error message', async () => {
    signInMock.mockResolvedValue({
      data: { user: null },
      error: { message: 'something weird from supabase' },
    });
    const result = await loginUser({ email: 'a@b.com', password: 'x' });
    expect(result).toEqual({ ok: false, reason: 'invalid_credentials' });
  });
});
