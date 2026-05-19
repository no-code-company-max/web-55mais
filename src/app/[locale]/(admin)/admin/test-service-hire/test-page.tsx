'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import {
  getHireBootstrap,
  type HireBootstrap,
} from '@/features/service-hire/actions/get-hire-bootstrap';
import type { PublishedServiceOption } from '@/features/service-hire/actions/list-published-services';
import { buildServiceHireHints } from '@/features/service-hire/lib/build-hints';
import { ServiceHireWizard } from '@/features/service-hire/components/wizard';

type Props = {
  services: PublishedServiceOption[];
  locale: string;
};

export function TestServiceHirePage({ services, locale }: Props) {
  const t = useTranslations('AdminTestServiceHire');
  const tg = useTranslations();
  const [serviceId, setServiceId] = useState<string>('');
  const [data, setData] = useState<HireBootstrap | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, startTransition] = useTransition();

  const reset = () => {
    setServiceId('');
    setData(null);
    setError(null);
  };

  const handleSelect = (id: string) => {
    setServiceId(id);
    setError(null);
    if (!id) {
      setData(null);
      return;
    }
    startTransition(async () => {
      const res = await getHireBootstrap(id, locale);
      if (!res.ok) {
        setData(null);
        setError(
          res.reason === 'not_found'
            ? tg('ServiceHire.unavailableNotFound')
            : res.reason === 'no_active_countries'
              ? tg('ServiceHire.unavailableNoCountries')
              : tg('ServiceHire.unavailableGeneric'),
        );
        return;
      }
      setData(res.data);
    });
  };

  return (
    <div className="space-y-6">
      <div className="space-y-1.5">
        <Label htmlFor="service-picker">{t('chooseService')}</Label>
        <Select value={serviceId} onValueChange={(v) => handleSelect(v ?? '')}>
          <SelectTrigger id="service-picker">
            <SelectValue placeholder={t('chooseServicePlaceholder')}>
              {(v: string) =>
                services.find((s) => s.id === v)?.name ??
                t('chooseServicePlaceholder')
              }
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {services.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {services.length === 0 && (
          <p className="text-muted-foreground text-xs italic">{t('noServices')}</p>
        )}
      </div>

      {isLoading && (
        <p className="text-muted-foreground text-sm">{t('loading')}</p>
      )}

      {error && !isLoading && (
        <p role="alert" className="text-sm font-medium text-red-700">
          {error}
        </p>
      )}

      {data && !isLoading && (
        <div className="space-y-3 rounded-md border p-4">
          <p className="text-muted-foreground text-xs">
            {t('countriesLabel')}: {data.service.activeCountryCodes.join(', ') || '—'}{' '}
            · {t('questionsCount', { count: data.service.questions.length })}
          </p>
          <ServiceHireWizard
            service={data.service}
            locale={locale}
            fiscalIdTypes={data.fiscalIdTypes}
            hints={buildServiceHireHints(tg, data.service.name)}
            locationOptions={data.locationOptions}
            onClose={reset}
          />
        </div>
      )}
    </div>
  );
}
