import React from 'react';
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

vi.mock('@/lib/i18n/navigation', () => ({
  useRouter: () => ({ push: pushMock, refresh: refreshMock }),
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

import { ResetPasswordForm } from '../reset-password-form';
import type { UpdatePasswordResult } from '../../actions/update-password';

type Props = React.ComponentProps<typeof ResetPasswordForm>;

function renderForm(overrides: Partial<Props> = {}) {
  const onSubmit = vi.fn<(input: unknown) => Promise<UpdatePasswordResult>>();
  const props: Props = {
    onSubmit,
    nextPath: '/es/mi-cuenta',
    ...overrides,
  };
  const utils = render(<ResetPasswordForm {...props} />);
  return { ...utils, onSubmit };
}

function typeBoth(password: string, confirm: string) {
  fireEvent.change(document.getElementById('reset-password') as HTMLInputElement, {
    target: { value: password },
  });
  fireEvent.change(document.getElementById('reset-confirm') as HTMLInputElement, {
    target: { value: confirm },
  });
}

describe('ResetPasswordForm', () => {
  beforeEach(() => {
    pushMock.mockReset();
    refreshMock.mockReset();
  });
  afterEach(() => cleanup());

  it('renders password + confirm inputs and submit button', () => {
    renderForm();
    expect(document.getElementById('reset-password')).not.toBeNull();
    expect(document.getElementById('reset-confirm')).not.toBeNull();
    expect(
      screen.getByRole('button', { name: /^submit$/i }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('happy path: submits password+confirm, success screen, router.push(nextPath) + refresh', async () => {
    const { onSubmit } = renderForm();
    onSubmit.mockResolvedValueOnce({ ok: true });

    typeBoth('strong-secret-1', 'strong-secret-1');
    fireEvent.click(screen.getByRole('button', { name: /^submit$/i }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledTimes(1);
    });
    expect(onSubmit).toHaveBeenCalledWith({
      password: 'strong-secret-1',
      confirm: 'strong-secret-1',
    });
    expect(await screen.findByText(/successTitle/i)).toBeInTheDocument();
    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith('/es/mi-cuenta');
    });
    expect(refreshMock).toHaveBeenCalled();
  });

  it('schema mismatch (Zod refine): focuses confirm, does not call action', async () => {
    const { onSubmit } = renderForm();

    typeBoth('strong-secret-1', 'strong-secret-2');
    fireEvent.click(screen.getByRole('button', { name: /^submit$/i }));

    await waitFor(() => {
      expect(document.getElementById('reset-confirm')).toHaveFocus();
    });
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('schema weak password (less than 8 chars): focuses password, does not call action', async () => {
    const { onSubmit } = renderForm();
    typeBoth('short', 'short');
    fireEvent.click(screen.getByRole('button', { name: /^submit$/i }));

    await waitFor(() => {
      expect(document.getElementById('reset-password')).toHaveFocus();
    });
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('action weak_password: shows alert + focuses password', async () => {
    const { onSubmit } = renderForm();
    onSubmit.mockResolvedValueOnce({ ok: false, reason: 'weak_password' });

    typeBoth('strong-secret-1', 'strong-secret-1');
    fireEvent.click(screen.getByRole('button', { name: /^submit$/i }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('errorWeakPassword');
    await waitFor(() => {
      expect(document.getElementById('reset-password')).toHaveFocus();
    });
    expect(pushMock).not.toHaveBeenCalled();
  });

  it('action no_session: shows alert with "request again" link to /recuperar; no redirect', async () => {
    const { onSubmit } = renderForm();
    onSubmit.mockResolvedValueOnce({ ok: false, reason: 'no_session' });

    typeBoth('strong-secret-1', 'strong-secret-1');
    fireEvent.click(screen.getByRole('button', { name: /^submit$/i }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('errorNoSession');
    expect(
      screen.getByRole('link', { name: /backToRequest/i }),
    ).toHaveAttribute('href', '/recuperar');
    expect(pushMock).not.toHaveBeenCalled();
  });

  it('action code_already_used (G25): shows alert + request-again link', async () => {
    const { onSubmit } = renderForm();
    onSubmit.mockResolvedValueOnce({
      ok: false,
      reason: 'code_already_used',
    });

    typeBoth('strong-secret-1', 'strong-secret-1');
    fireEvent.click(screen.getByRole('button', { name: /^submit$/i }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('errorCodeAlreadyUsed');
    expect(
      screen.getByRole('link', { name: /backToRequest/i }),
    ).toHaveAttribute('href', '/recuperar');
  });

  it('action generic error: shows generic alert, focuses password, no request-again link', async () => {
    const { onSubmit } = renderForm();
    onSubmit.mockResolvedValueOnce({ ok: false, reason: 'error' });

    typeBoth('strong-secret-1', 'strong-secret-1');
    fireEvent.click(screen.getByRole('button', { name: /^submit$/i }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('errorGeneric');
    expect(
      screen.queryByRole('link', { name: /backToRequest/i }),
    ).toBeNull();
  });
});
