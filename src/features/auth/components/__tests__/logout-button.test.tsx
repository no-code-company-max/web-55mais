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
}));

import { LogoutButton } from '../logout-button';
import type { LogoutResult } from '../../actions/logout-user';

type Props = React.ComponentProps<typeof LogoutButton>;

function renderBtn(overrides: Partial<Props> = {}) {
  const onLogout = vi.fn<() => Promise<LogoutResult>>();
  const props: Props = {
    onLogout,
    redirectTo: '/es',
    ...overrides,
  };
  const utils = render(<LogoutButton {...props} />);
  return { ...utils, onLogout };
}

describe('LogoutButton', () => {
  beforeEach(() => {
    pushMock.mockReset();
    refreshMock.mockReset();
  });
  afterEach(() => cleanup());

  it('renders the logout label', () => {
    renderBtn();
    expect(
      screen.getByRole('button', { name: /^logout$/i }),
    ).toBeInTheDocument();
  });

  it('happy path: calls action, refreshes and pushes redirectTo', async () => {
    const { onLogout } = renderBtn();
    onLogout.mockResolvedValueOnce({ ok: true });

    fireEvent.click(screen.getByRole('button', { name: /^logout$/i }));

    await waitFor(() => {
      expect(onLogout).toHaveBeenCalledTimes(1);
    });
    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith('/es');
    });
    expect(refreshMock).toHaveBeenCalled();
  });

  it('failure: stays on page, no redirect', async () => {
    const { onLogout } = renderBtn();
    onLogout.mockResolvedValueOnce({ ok: false, reason: 'error' });

    fireEvent.click(screen.getByRole('button', { name: /^logout$/i }));

    await waitFor(() => {
      expect(onLogout).toHaveBeenCalledTimes(1);
    });
    expect(pushMock).not.toHaveBeenCalled();
    expect(refreshMock).not.toHaveBeenCalled();
  });
});
