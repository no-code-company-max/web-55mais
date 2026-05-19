import { describe, it, expect, vi, beforeEach } from 'vitest';

const signUpMock = vi.fn();

// Admin chain mock: from('profiles').update(...).eq('id', uid) resolves.
const profilesUpdateChain = {
  update: vi.fn(),
  eq: vi.fn(),
};
const adminFromMock = vi.fn(() => profilesUpdateChain);

vi.mock('@/lib/supabase/server', () => ({
  createClient: () => ({ auth: { signUp: signUpMock } }),
}));

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({ from: adminFromMock }),
}));

vi.mock('@/shared/lib/seo/site', () => ({
  absoluteUrl: (p: string) => `https://example.test${p}`,
}));

import { registerUser } from '../register-user';

const validInput = {
  full_name: 'Ana López',
  phone: '+34 600 111 222',
  preferred_country: '11111111-1111-1111-1111-111111111111',
  preferred_city: '22222222-2222-2222-2222-222222222222',
  email: 'ana@example.com',
  password: 'strong-secret-1',
  locale: 'es',
};

describe('registerUser', () => {
  beforeEach(() => {
    signUpMock.mockReset();
    profilesUpdateChain.update.mockReset().mockReturnValue(profilesUpdateChain);
    profilesUpdateChain.eq
      .mockReset()
      .mockResolvedValue({ data: null, error: null });
    adminFromMock.mockClear();
  });

  it('happy path: signs up, updates the profile via admin client, returns userId', async () => {
    signUpMock.mockResolvedValue({
      data: { user: { id: 'user-1' }, session: null },
      error: null,
    });

    const result = await registerUser(validInput);

    expect(result).toEqual({ ok: true, data: { userId: 'user-1' } });
    expect(signUpMock).toHaveBeenCalledWith({
      email: 'ana@example.com',
      password: 'strong-secret-1',
      options: {
        data: { full_name: 'Ana López' },
        emailRedirectTo:
          'https://example.test/auth/callback?type=signup&locale=es',
      },
    });
    // Profile UPDATE goes through the ADMIN client (service-role), not
    // the anon client — see plan G20/C2.
    expect(adminFromMock).toHaveBeenCalledWith('profiles');
    expect(profilesUpdateChain.update).toHaveBeenCalledWith({
      phone: '+34 600 111 222',
      preferred_country: '11111111-1111-1111-1111-111111111111',
      preferred_city: '22222222-2222-2222-2222-222222222222',
    });
    expect(profilesUpdateChain.eq).toHaveBeenCalledWith('id', 'user-1');
  });

  it('normalises email (trim + lowercase) before sign up', async () => {
    signUpMock.mockResolvedValue({
      data: { user: { id: 'user-1' }, session: null },
      error: null,
    });
    await registerUser({ ...validInput, email: '  ANA@Example.com ' });
    expect(signUpMock).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'ana@example.com' }),
    );
  });

  it('returns email_already_registered and SKIPS the UPDATE (G23/W6)', async () => {
    signUpMock.mockResolvedValue({
      data: { user: null, session: null },
      error: { message: 'User already registered' },
    });

    const result = await registerUser(validInput);

    expect(result).toEqual({ ok: false, reason: 'email_already_registered' });
    expect(adminFromMock).not.toHaveBeenCalled();
    expect(profilesUpdateChain.update).not.toHaveBeenCalled();
  });

  it('returns weak_password when Supabase signals it', async () => {
    signUpMock.mockResolvedValue({
      data: { user: null, session: null },
      error: { message: 'Password should be at least 8 characters', code: 'weak_password' },
    });
    const result = await registerUser(validInput);
    expect(result).toEqual({ ok: false, reason: 'weak_password' });
  });

  it('returns error on invalid input (schema)', async () => {
    const result = await registerUser({
      ...validInput,
      password: 'short', // < 8
    });
    expect(result).toEqual({ ok: false, reason: 'error' });
    expect(signUpMock).not.toHaveBeenCalled();
  });

  it('returns error if profile UPDATE fails (admin client error)', async () => {
    signUpMock.mockResolvedValue({
      data: { user: { id: 'user-1' }, session: null },
      error: null,
    });
    profilesUpdateChain.eq.mockResolvedValue({
      data: null,
      error: { message: 'fk violation' },
    });

    const result = await registerUser(validInput);
    expect(result).toEqual({ ok: false, reason: 'error' });
  });
});
