import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  render,
  screen,
  fireEvent,
  cleanup,
  waitFor,
} from '@testing-library/react';

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

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

import { ForgotPasswordForm } from '../forgot-password-form';
import type { RequestPasswordResetResult } from '../../actions/request-password-reset';

type Props = React.ComponentProps<typeof ForgotPasswordForm>;

function renderForm(overrides: Partial<Props> = {}) {
  const onSubmit =
    vi.fn<(input: { email: string; locale: string }) =>
      Promise<RequestPasswordResetResult>>();
  const props: Props = {
    onSubmit,
    locale: 'es',
    ...overrides,
  };
  const utils = render(<ForgotPasswordForm {...props} />);
  return { ...utils, onSubmit };
}

describe('ForgotPasswordForm', () => {
  afterEach(() => cleanup());

  it('renders email field + submit + back-to-login link', () => {
    renderForm();
    expect(
      screen.getByRole('textbox', { name: /emailLabel/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /^submit$/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /backToLogin/i }),
    ).toHaveAttribute('href', '/login');
    expect(screen.queryByText(/sentTitle/i)).toBeNull();
  });

  it('happy path: submits normalized email + locale, shows sent screen', async () => {
    const { onSubmit } = renderForm();
    onSubmit.mockResolvedValueOnce({ ok: true });

    fireEvent.change(screen.getByRole('textbox', { name: /emailLabel/i }), {
      target: { value: '  User@Example.com  ' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^submit$/i }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledTimes(1);
    });
    expect(onSubmit).toHaveBeenCalledWith({
      email: 'user@example.com',
      locale: 'es',
    });
    expect(await screen.findByText(/sentTitle/i)).toBeInTheDocument();
    expect(screen.getByText(/sentBody/i)).toBeInTheDocument();
  });

  it('shows the same sent screen even if the action rejects (G3 belt-and-brace)', async () => {
    const { onSubmit } = renderForm();
    onSubmit.mockRejectedValueOnce(new Error('boom'));

    fireEvent.change(screen.getByRole('textbox', { name: /emailLabel/i }), {
      target: { value: 'user@example.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^submit$/i }));

    expect(await screen.findByText(/sentTitle/i)).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('schema invalid (empty email): does not call action, focuses email', async () => {
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
