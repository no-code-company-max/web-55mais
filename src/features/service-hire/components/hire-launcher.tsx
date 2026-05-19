'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { Modal } from '@/shared/components/modal';
import {
  getHireBootstrap,
  type HireBootstrap,
} from '../actions/get-hire-bootstrap';
import { buildServiceHireHints } from '../lib/build-hints';
import { ServiceHireWizard } from './wizard';

type Props = {
  serviceId: string;
  serviceName: string;
  locale: string;
  ctaLabel: string;
};

// Client island injected into the (server) ServiceDetailHero via its
// ctaSlot. One server-action round-trip (getHireBootstrap) gathers
// service config + País/Ciudad options + fiscal id types in parallel
// internally — Next.js serializes client-invoked server actions, so a
// single action is the only way to avoid summing three round-trips.
// On failure we render an inline role="alert" rather than opening the
// modal, so users on the public layout always get visible feedback
// (no dependency on a global <Toaster>).
export function HireLauncher({
  serviceId,
  serviceName,
  locale,
  ctaLabel,
}: Props) {
  const t = useTranslations();
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<HireBootstrap | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, startTransition] = useTransition();
  const alertRef = useRef<HTMLParagraphElement>(null);

  const hints = buildServiceHireHints(t, serviceName);

  useEffect(() => {
    if (error) alertRef.current?.focus();
  }, [error]);

  const handleOpen = () => {
    if (data) {
      setOpen(true);
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await getHireBootstrap(serviceId, locale);
      if (!res.ok) {
        setError(
          res.reason === 'not_found'
            ? hints.errors.notFound
            : res.reason === 'no_active_countries'
              ? hints.errors.noCountries
              : hints.errors.generic,
        );
        return;
      }
      setData(res.data);
      setOpen(true);
    });
  };

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        disabled={isLoading}
        aria-busy={isLoading ? 'true' : undefined}
        className="inline-flex items-center justify-center rounded-full bg-brand-mustard px-7 py-3.5 text-base font-bold text-brand-text transition-opacity hover:opacity-90 disabled:opacity-60"
      >
        {isLoading ? t('Common.loading') : ctaLabel}
      </button>

      {error && (
        <p
          ref={alertRef}
          role="alert"
          tabIndex={-1}
          className="mt-3 text-sm font-medium text-red-700 outline-none"
        >
          {error}
        </p>
      )}

      {data && (
        <Modal
          open={open}
          onOpenChange={setOpen}
          title={serviceName}
          closeAriaLabel={hints.modalClose}
          size="lg"
        >
          <ServiceHireWizard
            service={data.service}
            locale={locale}
            fiscalIdTypes={data.fiscalIdTypes}
            hints={hints}
            locationOptions={data.locationOptions}
            onClose={() => setOpen(false)}
          />
        </Modal>
      )}
    </>
  );
}
