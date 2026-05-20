import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  render,
  screen,
  fireEvent,
  cleanup,
  waitFor,
} from '@testing-library/react';
import { NextRequest } from 'next/server';

// Shared stateful Supabase mock — one auth journey reuses the same client.
// Each stage of the flow advances the state these spies report on.
const signInWithPasswordMock = vi.fn();
const resetPasswordForEmailMock = vi.fn();
const exchangeCodeForSessionMock = vi.fn();
const getUserMock = vi.fn();
const updateUserMock = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  createClient: () => ({
    auth: {
      signInWithPassword: signInWithPasswordMock,
      resetPasswordForEmail: resetPasswordForEmailMock,
      exchangeCodeForSession: exchangeCodeForSessionMock,
      getUser: getUserMock,
      updateUser: updateUserMock,
    },
  }),
}));

// Stable origin so buildAuthCallbackUrl is deterministic across the flow.
vi.mock('@/shared/lib/seo/site', () => ({
  absoluteUrl: (p: string) => `https://example.test${p}`,
}));

const pushMock = vi.fn();
const refreshMock = vi.fn();

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock('next/navigation', async () => {
  const actual = await vi.importActual<typeof import('next/navigation')>(
    'next/navigation',
  );
  return {
    ...actual,
    useRouter: () => ({ push: pushMock, refresh: refreshMock }),
  };
});

vi.mock('@/lib/i18n/navigation', () => ({
  Link: ({
    href,
    children,
    ...rest
  }: {
    href: string;
    children: React.ReactNode;
  }) => (
    <a href={typeof href === 'string' ? href : '#'} {...rest}>
      {children}
    </a>
  ),
}));

import { LoginForm } from '../components/login-form';
import { ForgotPasswordForm } from '../components/forgot-password-form';
import { ResetPasswordForm } from '../components/reset-password-form';
import { loginUser } from '../actions/login-user';
import { requestPasswordReset } from '../actions/request-password-reset';
import { updatePassword } from '../actions/update-password';
import { handleAuthCallback as authCallback } from '../lib/handle-auth-callback';

const USER = { id: 'u-1', email: 'maria@example.com' };

describe('auth flow — login → forgot → callback → reset → mi-cuenta', () => {
  beforeEach(() => {
    signInWithPasswordMock.mockReset();
    resetPasswordForEmailMock.mockReset();
    exchangeCodeForSessionMock.mockReset();
    getUserMock.mockReset();
    updateUserMock.mockReset();
    pushMock.mockReset();
    refreshMock.mockReset();
  });
  afterEach(() => cleanup());

  it('drives the full recovery journey through real actions and the callback handler', async () => {
    // ── Stage 1 — Login fails first, then user clicks the forgot link.
    signInWithPasswordMock.mockResolvedValueOnce({
      data: { user: null },
      error: { message: 'Invalid login credentials' },
    });

    render(
      <LoginForm
        onSubmit={loginUser}
        locale="es"
        nextPath="/es/mi-cuenta"
        initialError={null}
      />,
    );

    fireEvent.change(screen.getByRole('textbox', { name: /emailLabel/i }), {
      target: { value: 'maria@example.com' },
    });
    fireEvent.change(
      document.querySelector('input[type="password"]') as HTMLInputElement,
      { target: { value: 'forgottenPassword' } },
    );
    fireEvent.click(screen.getByRole('button', { name: /^submit$/i }));

    const loginAlert = await screen.findByRole('alert');
    expect(loginAlert).toHaveTextContent('errorInvalidCredentials');
    expect(pushMock).not.toHaveBeenCalled();
    expect(
      screen.getByRole('link', { name: /forgot/i }),
    ).toHaveAttribute('href', '/recuperar');
    cleanup();

    // ── Stage 2 — Forgot-password form posts the email; Supabase is told
    // to send a recovery email pointing at our /auth/callback URL.
    resetPasswordForEmailMock.mockResolvedValueOnce({
      data: {},
      error: null,
    });

    render(<ForgotPasswordForm onSubmit={requestPasswordReset} locale="es" />);

    fireEvent.change(screen.getByRole('textbox', { name: /emailLabel/i }), {
      target: { value: '  Maria@Example.com  ' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^submit$/i }));

    expect(await screen.findByText(/sentTitle/i)).toBeInTheDocument();
    await waitFor(() => {
      expect(resetPasswordForEmailMock).toHaveBeenCalledTimes(1);
    });
    expect(resetPasswordForEmailMock).toHaveBeenCalledWith(
      'maria@example.com',
      {
        redirectTo:
          'https://example.test/auth/callback?type=recovery&locale=es',
      },
    );
    cleanup();

    // ── Stage 3 — Email link arrives at /auth/callback with the recovery
    // code; handler exchanges it and redirects into the reset page.
    exchangeCodeForSessionMock.mockResolvedValueOnce({
      data: { session: { user: USER } },
      error: null,
    });

    const callbackUrl =
      'https://example.test/auth/callback?code=recovery-code&type=recovery&locale=es';
    const response = await authCallback(new NextRequest(callbackUrl));

    expect(exchangeCodeForSessionMock).toHaveBeenCalledWith('recovery-code');
    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe(
      'https://example.test/es/recuperar/nueva-contrasena',
    );

    // ── Stage 4 — Reset-password form runs with a live session and
    // pushes the user into /mi-cuenta on success.
    getUserMock.mockResolvedValueOnce({ data: { user: USER } });
    updateUserMock.mockResolvedValueOnce({
      data: { user: USER },
      error: null,
    });

    render(
      <ResetPasswordForm
        onSubmit={updatePassword}
        nextPath="/es/mi-cuenta"
      />,
    );

    fireEvent.change(document.getElementById('reset-password') as HTMLInputElement, {
      target: { value: 'newSecret123' },
    });
    fireEvent.change(document.getElementById('reset-confirm') as HTMLInputElement, {
      target: { value: 'newSecret123' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^submit$/i }));

    await waitFor(() => {
      expect(updateUserMock).toHaveBeenCalledWith({ password: 'newSecret123' });
    });
    expect(await screen.findByText(/successTitle/i)).toBeInTheDocument();
    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith('/es/mi-cuenta');
    });
    expect(refreshMock).toHaveBeenCalled();
  });

  it('callback with no code bounces to /[locale]/login?error=expired', async () => {
    const response = await authCallback(
      new NextRequest('https://example.test/auth/callback?locale=en'),
    );
    expect(exchangeCodeForSessionMock).not.toHaveBeenCalled();
    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe(
      'https://example.test/en/login?error=expired',
    );
  });

  it('callback with bad locale falls back to es', async () => {
    exchangeCodeForSessionMock.mockResolvedValueOnce({
      data: { session: { user: USER } },
      error: null,
    });
    const response = await authCallback(
      new NextRequest(
        'https://example.test/auth/callback?code=x&type=signup&locale=zz',
      ),
    );
    expect(response.headers.get('location')).toBe(
      'https://example.test/es/mi-cuenta',
    );
  });
});
