import { describe, it, expect, vi, beforeEach } from 'vitest';

const resetMock = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  createClient: () => ({ auth: { resetPasswordForEmail: resetMock } }),
}));

vi.mock('@/shared/lib/seo/site', () => ({
  absoluteUrl: (p: string) => `https://example.test${p}`,
}));

import { requestPasswordReset } from '../request-password-reset';

describe('requestPasswordReset', () => {
  beforeEach(() => resetMock.mockReset());

  it('returns ok and calls Supabase with the absolute callback URL when email exists', async () => {
    resetMock.mockResolvedValue({ data: {}, error: null });
    const result = await requestPasswordReset({
      email: 'a@b.com',
      locale: 'es',
    });
    expect(result).toEqual({ ok: true });
    expect(resetMock).toHaveBeenCalledWith('a@b.com', {
      redirectTo: 'https://example.test/auth/callback?type=recovery&locale=es',
    });
  });

  it('still returns ok when Supabase returns an error (anti-enumeration)', async () => {
    resetMock.mockResolvedValue({
      data: null,
      error: { message: 'rate limited' },
    });
    const result = await requestPasswordReset({
      email: 'a@b.com',
      locale: 'es',
    });
    expect(result).toEqual({ ok: true });
  });

  it('still returns ok when Supabase throws (network blip, 429, anything)', async () => {
    resetMock.mockResolvedValue({ data: null, error: null });
    // Wrap reject in catch-self to keep vitest's unhandled-rejection
    // detector happy while still exercising the production catch path.
    resetMock.mockImplementationOnce(() => {
      const p = Promise.reject(new Error('boom'));
      p.catch(() => {});
      return p;
    });
    const result = await requestPasswordReset({
      email: 'a@b.com',
      locale: 'es',
    });
    expect(result).toEqual({ ok: true });
  });

  it('normalises email before calling Supabase', async () => {
    resetMock.mockResolvedValue({ data: {}, error: null });
    await requestPasswordReset({
      email: '  A@B.COM ',
      locale: 'en',
    });
    expect(resetMock).toHaveBeenCalledWith('a@b.com', expect.any(Object));
  });

  it('returns ok even on schema invalid (still no leak)', async () => {
    const result = await requestPasswordReset({
      email: 'not-an-email',
      locale: 'es',
    });
    expect(result).toEqual({ ok: true });
    expect(resetMock).not.toHaveBeenCalled();
  });
});
