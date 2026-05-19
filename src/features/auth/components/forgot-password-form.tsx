'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link } from '@/lib/i18n/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { forgotSchema, type ForgotInput } from '../schemas';
import type { RequestPasswordResetResult } from '../actions/request-password-reset';

type Props = {
  onSubmit: (input: { email: string; locale: string }) => Promise<
    RequestPasswordResetResult
  >;
  locale: string;
};

// Forgot-password surface. Anti-enumeration (G3): the action always
// resolves ok, and we mirror that in the UI — same "sent" screen and
// copy whether the email is registered, rate-limited, or anything else.
// We also belt-and-brace against thrown actions by treating any
// resolution as success.
export function ForgotPasswordForm({ onSubmit, locale }: Props) {
  const t = useTranslations('Auth.forgot');
  const [sent, setSent] = useState(false);
  const [isPending, startTransition] = useTransition();

  const focusEmail = () => {
    if (typeof document === 'undefined') return;
    document.getElementById('forgot-email')?.focus();
  };

  const form = useForm<ForgotInput>({
    resolver: zodResolver(forgotSchema),
    defaultValues: { email: '' },
    mode: 'onSubmit',
  });

  const submit = (data: ForgotInput) => {
    startTransition(async () => {
      try {
        await onSubmit({ email: data.email, locale });
      } catch {
        // Action is meant to swallow errors; if it doesn't, we still
        // show the same sent screen to avoid leaking existence (G3).
      }
      setSent(true);
    });
  };

  if (sent) {
    return (
      <div className="space-y-5 text-center">
        <h2 className="text-xl font-semibold text-brand-text">
          {t('sentTitle')}
        </h2>
        <p className="text-sm text-brand-text/70">{t('sentBody')}</p>
        <Link
          href="/login"
          className="inline-block font-semibold text-brand-coral hover:underline"
        >
          {t('backToLogin')}
        </Link>
      </div>
    );
  }

  return (
    <form
      onSubmit={form.handleSubmit(submit, focusEmail)}
      className="space-y-5"
      noValidate
    >
      <p className="text-sm text-brand-text/70">{t('body')}</p>

      <div className="space-y-2">
        <Label htmlFor="forgot-email">{t('emailLabel')}</Label>
        <Controller
          control={form.control}
          name="email"
          render={({ field, fieldState }) => (
            <Input
              id="forgot-email"
              type="email"
              autoComplete="email"
              placeholder={t('emailPlaceholder')}
              aria-invalid={Boolean(fieldState.error) || undefined}
              value={field.value}
              onChange={(e) => field.onChange(e.target.value)}
              onBlur={field.onBlur}
              ref={field.ref}
              name={field.name}
            />
          )}
        />
      </div>

      <Button
        type="submit"
        disabled={isPending}
        className="w-full rounded-full bg-brand-coral py-3 text-base font-semibold text-white hover:bg-brand-coral-deep"
      >
        {isPending ? t('submitting') : t('submit')}
      </Button>

      <p className="text-center text-sm text-brand-text/70">
        <Link
          href="/login"
          className="font-semibold text-brand-coral hover:underline"
        >
          {t('backToLogin')}
        </Link>
      </p>
    </form>
  );
}
