'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { Link } from '@/lib/i18n/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { loginSchema, type LoginInput } from '../schemas';
import type { LoginResult } from '../actions/login-user';
import { PasswordInput } from './password-input';
import { GoogleButton } from './google-button';

type Props = {
  onSubmit: (input: unknown) => Promise<LoginResult>;
  locale: string;
  nextPath: string;
  initialError: 'expired' | null;
};

type ErrorReason =
  | 'invalid_credentials'
  | 'email_not_confirmed'
  | 'error'
  | 'expired';

const ERROR_KEY: Record<ErrorReason, string> = {
  invalid_credentials: 'errorInvalidCredentials',
  email_not_confirmed: 'errorEmailNotConfirmed',
  error: 'errorGeneric',
  expired: 'errorExpired',
};

export function LoginForm({ onSubmit, nextPath, initialError }: Props) {
  const t = useTranslations('Auth.login');
  const router = useRouter();
  const [submitError, setSubmitError] = useState<ErrorReason | null>(
    initialError,
  );
  const [isPending, startTransition] = useTransition();
  // Focus management goes through the DOM id rather than RHF's setFocus or a
  // ref composed across Controller + base-ui — base-ui's ref-composer
  // doesn't reliably propagate the DOM node back, and the id is the source
  // of truth either way. Part of the a11y contract (G19).
  const focusEmail = () => {
    if (typeof document !== 'undefined') {
      document.getElementById('login-email')?.focus();
    }
  };

  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
    mode: 'onSubmit',
  });

  const submit = (data: LoginInput) => {
    setSubmitError(null);
    startTransition(async () => {
      const result = await onSubmit(data);
      if (result.ok) {
        // refresh() ensures the server re-reads the auth cookie set by
        // the action so /mi-cuenta resolves the user on the next render.
        router.refresh();
        router.push(nextPath);
        return;
      }
      setSubmitError(result.reason);
      focusEmail();
    });
  };

  return (
    <form
      onSubmit={form.handleSubmit(submit, focusEmail)}
      className="space-y-5"
      noValidate
    >
      <div className="space-y-2">
        <Label htmlFor="login-email">{t('emailLabel')}</Label>
        <Controller
          control={form.control}
          name="email"
          render={({ field, fieldState }) => (
            <Input
              id="login-email"
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

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="login-password">{t('passwordLabel')}</Label>
          <Link
            href="/recuperar"
            className="text-sm font-medium text-brand-coral hover:underline"
          >
            {t('forgot')}
          </Link>
        </div>
        <Controller
          control={form.control}
          name="password"
          render={({ field, fieldState }) => (
            <PasswordInput
              id="login-password"
              autoComplete="current-password"
              placeholder={t('passwordPlaceholder')}
              aria-invalid={Boolean(fieldState.error) || undefined}
              toggleLabels={{
                show: t('passwordToggleShow'),
                hide: t('passwordToggleHide'),
              }}
              value={field.value}
              onChange={(e) => field.onChange(e.target.value)}
              onBlur={field.onBlur}
              ref={field.ref}
              name={field.name}
            />
          )}
        />
      </div>

      {submitError && (
        <div
          role="alert"
          aria-live="polite"
          className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {t(ERROR_KEY[submitError])}
        </div>
      )}

      <Button
        type="submit"
        disabled={isPending}
        className="w-full rounded-full bg-brand-coral py-3 text-base font-semibold text-white hover:bg-brand-coral-deep"
      >
        {isPending ? t('submitting') : t('submit')}
      </Button>

      <div className="flex items-center gap-3 py-1">
        <span className="h-px flex-1 bg-brand-text/15" />
        <span className="text-xs uppercase tracking-wide text-brand-text/50">
          {t('orWith')}
        </span>
        <span className="h-px flex-1 bg-brand-text/15" />
      </div>

      <GoogleButton
        label={t('googleButton')}
        soonLabel={t('googleSoon')}
      />

      <p className="text-center text-sm text-brand-text/70">
        <Link
          href="/registro"
          className="font-semibold text-brand-coral hover:underline"
        >
          {t('createAccount')}
        </Link>
      </p>
    </form>
  );
}
