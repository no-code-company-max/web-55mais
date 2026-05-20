import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  render,
  screen,
  fireEvent,
  cleanup,
  waitFor,
} from '@testing-library/react';

const pushMock = vi.fn();
const refreshMock = vi.fn();

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock, refresh: refreshMock }),
}));

vi.mock('@/lib/i18n/navigation', () => ({
  Link: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={typeof href === 'string' ? href : '#'} {...rest}>
      {children}
    </a>
  ),
}));

import { LoginForm } from '../login-form';
import type { LoginResult } from '../../actions/login-user';

type Props = React.ComponentProps<typeof LoginForm>;

function renderForm(overrides: Partial<Props> = {}) {
  const onSubmit = vi.fn<(input: unknown) => Promise<LoginResult>>();
  const props: Props = {
    onSubmit,
    locale: 'es',
    nextPath: '/es/mi-cuenta',
    initialError: null,
    ...overrides,
  };
  const utils = render(<LoginForm {...props} />);
  return { ...utils, onSubmit };
}

describe('LoginForm', () => {
  beforeEach(() => {
    pushMock.mockReset();
    refreshMock.mockReset();
  });
  afterEach(() => cleanup());

  it('renders email, password, submit, forgot link, register link, and disabled google button', () => {
    renderForm();
    expect(
      screen.getByRole('textbox', { name: /emailLabel/i }),
    ).toBeInTheDocument();
    expect(document.querySelector('input[type="password"]')).not.toBeNull();
    expect(
      screen.getByRole('button', { name: /^submit$/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /forgot/i })).toHaveAttribute(
      'href',
      '/recuperar',
    );
    expect(
      screen.getByRole('link', { name: /createAccount/i }),
    ).toHaveAttribute('href', '/registro');
    const google = screen.getByRole('button', { name: /googleButton/i });
    expect(google).toBeDisabled();
  });

  it('happy path: submits normalized email + redirects via router.push(nextPath) + refresh', async () => {
    const { onSubmit } = renderForm();
    onSubmit.mockResolvedValueOnce({ ok: true, data: { userId: 'u1' } });

    fireEvent.change(screen.getByRole('textbox', { name: /emailLabel/i }), {
      target: { value: '  User@Example.com  ' },
    });
    fireEvent.change(
      document.querySelector('input[type="password"]') as HTMLInputElement,
      { target: { value: 'secret123' } },
    );
    fireEvent.click(screen.getByRole('button', { name: /^submit$/i }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledTimes(1);
    });
    expect(onSubmit).toHaveBeenCalledWith({
      email: 'user@example.com',
      password: 'secret123',
    });
    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith('/es/mi-cuenta');
    });
    expect(refreshMock).toHaveBeenCalled();
  });

  it('invalid_credentials: shows alert, no redirect, focuses email', async () => {
    const { onSubmit } = renderForm();
    onSubmit.mockResolvedValueOnce({ ok: false, reason: 'invalid_credentials' });

    fireEvent.change(screen.getByRole('textbox', { name: /emailLabel/i }), {
      target: { value: 'user@example.com' },
    });
    fireEvent.change(
      document.querySelector('input[type="password"]') as HTMLInputElement,
      { target: { value: 'wrongpass' } },
    );
    fireEvent.click(screen.getByRole('button', { name: /^submit$/i }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('errorInvalidCredentials');
    expect(pushMock).not.toHaveBeenCalled();
    expect(
      screen.getByRole('textbox', { name: /emailLabel/i }),
    ).toHaveFocus();
  });

  it('email_not_confirmed: shows the verify-email message', async () => {
    const { onSubmit } = renderForm();
    onSubmit.mockResolvedValueOnce({
      ok: false,
      reason: 'email_not_confirmed',
    });

    fireEvent.change(screen.getByRole('textbox', { name: /emailLabel/i }), {
      target: { value: 'user@example.com' },
    });
    fireEvent.change(
      document.querySelector('input[type="password"]') as HTMLInputElement,
      { target: { value: 'goodpassword' } },
    );
    fireEvent.click(screen.getByRole('button', { name: /^submit$/i }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('errorEmailNotConfirmed');
  });

  it('generic error: shows the generic retry alert', async () => {
    const { onSubmit } = renderForm();
    onSubmit.mockResolvedValueOnce({ ok: false, reason: 'error' });

    fireEvent.change(screen.getByRole('textbox', { name: /emailLabel/i }), {
      target: { value: 'user@example.com' },
    });
    fireEvent.change(
      document.querySelector('input[type="password"]') as HTMLInputElement,
      { target: { value: 'goodpassword' } },
    );
    fireEvent.click(screen.getByRole('button', { name: /^submit$/i }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('errorGeneric');
  });

  it('renders initialError when provided (e.g. ?error=expired from callback)', () => {
    renderForm({ initialError: 'expired' });
    expect(screen.getByRole('alert')).toHaveTextContent('errorExpired');
  });

  it('does not submit when schema invalid (empty fields) — focuses first invalid field', async () => {
    const { onSubmit } = renderForm();
    fireEvent.click(screen.getByRole('button', { name: /^submit$/i }));
    await waitFor(() => {
      expect(
        screen.getByRole('textbox', { name: /emailLabel/i }),
      ).toHaveFocus();
    });
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
