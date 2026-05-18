import type { ReactNode } from 'react';
import { unstable_setRequestLocale } from 'next-intl/server';
import { PublicShell } from '@/shared/components/marketing/public-shell';

type Props = {
  children: ReactNode;
  params: { locale: string };
};

// Same public shell as (public) but WITHOUT the newsletter band — the
// service detail page closes with its own "¿Tienes dudas?" CTA.
export default function ServiceDetailLayout({
  children,
  params: { locale },
}: Props) {
  unstable_setRequestLocale(locale);
  return (
    <PublicShell locale={locale} showNewsletter={false}>
      {children}
    </PublicShell>
  );
}
