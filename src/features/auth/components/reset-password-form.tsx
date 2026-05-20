'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { Link } from '@/lib/i18n/navigation';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { resetSchema, type ResetInput } from '../schemas';
import type { UpdatePasswordResult } from '../actions/update-password';
import { PasswordInput } from './password-input';

type Props = {
  onSubmit: (input: unknown) => Promise<UpdatePasswordResult>;
  nextPath: string;
};

type ErrorReason =
  | 'mismatch'
  | 'weak_password'
  | 'no_session'
  | 'code_already_used'
  | 'error';

const ERROR_KEY: Record<ErrorReason, string> = {
  mismatch: 'errorMismatch',
  weak_password: 'errorWeakPassword',
  no_session: 'errorNoSession',
  code_already_used: 'errorCodeAlreadyUsed',
  error: 'errorGeneric',
};

// Reasons that mean "this recovery link is gone" — the user needs a
// fresh email rather than another submit attempt. The UI surfaces a
// link to /recuperar instead of leaving them stuck on the form.
const REQUEST_AGAIN: ReadonlySet<ErrorReason> = new Set<ErrorReason>([
  'no_session',
  'code_already_used',
]);

const FIELD_ORDER: (keyof ResetInput)[] = ['password', 'confirm'];

const DOM_ID: Record<keyof ResetInput, string> = {
  password: 'reset-password',
  confirm: 'reset-confirm',
};

export function ResetPasswordForm({ onSubmit, nextPath }: Props) {
  const t = useTranslations('Auth.reset');
  const router = useRouter();
  const [submitError, setSubmitError] = useState<ErrorReason | null>(null);
  const [success, setSuccess] = useState(false);
  const [isPending, startTransition] = useTransition();

  const form = useForm<ResetInput>({
    resolver: zodResolver(resetSchema),
    defaultValues: { password: '', confirm: '' },
    mode: 'onSubmit',
  });

  // Focus management routes through DOM ids (same reason as login/
  // register forms: base-ui's ref composer doesn't reliably propagate
  // back through Controller).
  const focusFirstInvalid = (
    errors: Partial<Record<keyof ResetInput, unknown>> = {},
  ) => {
    if (typeof document === 'undefined') return;
    const first = FIELD_ORDER.find((k) => errors[k]) ?? 'password';
    document.getElementById(DOM_ID[first])?.focus();
  };

  const submit = (data: ResetInput) => {
    setSubmitError(null);
    startTransition(async () => {
      const result = await onSubmit(data);
      if (result.ok) {
        setSuccess(true);
        router.refresh();
        router.push(nextPath);
        return;
      }
      setSubmitError(result.reason);
      if (result.reason === 'mismatch') {
        document.getElementById(DOM_ID.confirm)?.focus();
      } else if (
        result.reason === 'weak_password' ||
        result.reason === 'error'
      ) {
        document.getElementById(DOM_ID.password)?.focus();
      }
      // no_session / code_already_used: no focus — the user is meant to
      // request a fresh email via the link in the alert, not retry.
    });
  };

  if (success) {
    return (
      <div className="space-y-3 text-center">
        <h2 className="text-xl font-semibold text-brand-text">
          {t('successTitle')}
        </h2>
        <p className="text-sm text-brand-text/70">{t('successBody')}</p>
      </div>
    );
  }

  return (
    <form
      onSubmit={form.handleSubmit(submit, (errors) =>
        focusFirstInvalid(errors as Record<keyof ResetInput, unknown>),
      )}
      className="space-y-5"
      noValidate
    >
      <p className="text-sm text-brand-text/70">{t('body')}</p>

      <div className="space-y-2">
        <Label htmlFor={DOM_ID.password}>{t('passwordLabel')}</Label>
        <Controller
          control={form.control}
          name="password"
          render={({ field, fieldState }) => (
            <PasswordInput
              id={DOM_ID.password}
              autoComplete="new-password"
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
        <p className="text-xs text-brand-text/60">{t('passwordHint')}</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor={DOM_ID.confirm}>{t('confirmLabel')}</Label>
        <Controller
          control={form.control}
          name="confirm"
          render={({ field, fieldState }) => (
            <PasswordInput
              id={DOM_ID.confirm}
              autoComplete="new-password"
              placeholder={t('confirmPlaceholder')}
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
          className="space-y-2 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          <p>{t(ERROR_KEY[submitError])}</p>
          {REQUEST_AGAIN.has(submitError) && (
            <Link
              href="/recuperar"
              className="inline-block font-semibold text-brand-coral hover:underline"
            >
              {t('backToRequest')}
            </Link>
          )}
        </div>
      )}

      <Button
        type="submit"
        disabled={isPending}
        className="w-full rounded-full bg-brand-coral py-3 text-base font-semibold text-white hover:bg-brand-coral-deep"
      >
        {isPending ? t('submitting') : t('submit')}
      </Button>
    </form>
  );
}
