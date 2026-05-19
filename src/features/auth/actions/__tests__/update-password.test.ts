import { describe, it, expect, vi, beforeEach } from 'vitest';

const getUserMock = vi.fn();
const updateUserMock = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  createClient: () => ({
    auth: { getUser: getUserMock, updateUser: updateUserMock },
  }),
}));

import { updatePassword } from '../update-password';

describe('updatePassword', () => {
  beforeEach(() => {
    getUserMock.mockReset();
    updateUserMock.mockReset();
  });

  it('returns ok on successful password update', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'u-1' } } });
    updateUserMock.mockResolvedValue({
      data: { user: { id: 'u-1' } },
      error: null,
    });
    const result = await updatePassword({
      password: 'newSecret123',
      confirm: 'newSecret123',
    });
    expect(result).toEqual({ ok: true });
    expect(updateUserMock).toHaveBeenCalledWith({ password: 'newSecret123' });
  });

  it('returns no_session when no active user', async () => {
    getUserMock.mockResolvedValue({ data: { user: null } });
    const result = await updatePassword({
      password: 'newSecret123',
      confirm: 'newSecret123',
    });
    expect(result).toEqual({ ok: false, reason: 'no_session' });
    expect(updateUserMock).not.toHaveBeenCalled();
  });

  it('returns error when mismatch (Zod refine)', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'u-1' } } });
    const result = await updatePassword({
      password: 'aaaaaaaa',
      confirm: 'bbbbbbbb',
    });
    expect(result).toEqual({ ok: false, reason: 'mismatch' });
  });

  it('returns weak_password when too short (defence in depth)', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'u-1' } } });
    const result = await updatePassword({
      password: 'short',
      confirm: 'short',
    });
    expect(result).toEqual({ ok: false, reason: 'weak_password' });
  });

  it('returns code_already_used when Supabase signals it', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'u-1' } } });
    updateUserMock.mockResolvedValue({
      data: null,
      error: {
        message: 'invalid recovery code',
        code: 'invalid_otp',
      },
    });
    const result = await updatePassword({
      password: 'newSecret123',
      confirm: 'newSecret123',
    });
    expect(result).toEqual({ ok: false, reason: 'code_already_used' });
  });

  it('returns error on generic supabase failure', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'u-1' } } });
    updateUserMock.mockResolvedValue({
      data: null,
      error: { message: 'something else' },
    });
    const result = await updatePassword({
      password: 'newSecret123',
      confirm: 'newSecret123',
    });
    expect(result).toEqual({ ok: false, reason: 'error' });
  });
});
