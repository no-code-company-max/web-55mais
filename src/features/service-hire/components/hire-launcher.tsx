'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { Modal } from '@/shared/components/modal';
import {
  getServiceForHire,
  type ServiceForHire,
} from '../actions/get-service-for-hire';
import { getHireLocationOptions } from '../actions/get-hire-location-options';
import {
  listFiscalIdTypes,
  type FiscalIdTypeOption,
} from '../actions/list-fiscal-id-types';
import type { HireLocationOptions } from '../lib/hire-location-types';
import { buildServiceHireHints } from '../lib/build-hints';
import { ServiceHireWizard } from './wizard';

type LoadedData = {
  service: ServiceForHire;
  locationOptions: HireLocationOptions;
  fiscalIdTypes: FiscalIdTypeOption[];
};

type Props = {
  serviceId: string;
  serviceName: string;
  locale: string;
  ctaLabel: string;
};

// Client island injected into the (server) ServiceDetailHero via its
// ctaSlot. SSG/HTML stay intact; the wizard's data (service config,
// País/Ciudad options, fiscal id types) is fetched lazily on first
// click — the public page never pays for it at build time.
export function HireLauncher({
  serviceId,
  serviceName,
  locale,
  ctaLabel,
}: Props) {
  const t = useTranslations();
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<LoadedData | null>(null);
  const [isLoading, startTransition] = useTransition();

  const handleOpen = () => {
    if (data) {
      setOpen(true);
      return;
    }
    startTransition(async () => {
      const [service, locationOptions, fiscalIdTypes] = await Promise.all([
        getServiceForHire(serviceId, locale),
        getHireLocationOptions(serviceId, locale),
        listFiscalIdTypes(locale),
      ]);
      if (!service) return;
      setData({ service, locationOptions, fiscalIdTypes });
      setOpen(true);
    });
  };

  const hints = buildServiceHireHints(t, serviceName);

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
