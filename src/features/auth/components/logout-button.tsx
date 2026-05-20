'use client';

import { useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import type { LogoutResult } from '../actions/logout-user';

type Props = {
  onLogout: () => Promise<LogoutResult>;
  redirectTo: string;
};

// Minimal QA-grade logout. Calls the server action, then refresh+push
// so the next render re-reads the (now empty) auth cookie. Failure
// stays on-page silently — for a placeholder button that's acceptable;
// a richer surface would surface a retry hint.
export function LogoutButton({ onLogout, redirectTo }: Props) {
  const t = useTranslations('Auth.account');
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handleClick = () => {
    startTransition(async () => {
      const result = await onLogout();
      if (result.ok) {
        router.refresh();
        router.push(redirectTo);
      }
    });
  };

  return (
    <Button
      type="button"
      variant="outline"
      disabled={isPending}
      onClick={handleClick}
      className="rounded-full"
    >
      {isPending ? t('loggingOut') : t('logout')}
    </Button>
  );
}
