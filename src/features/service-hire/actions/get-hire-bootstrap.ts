'use server';

import { createClient } from '@/lib/supabase/server';
import { localizedField } from '@/shared/lib/i18n/localize';
import {
  getSelectedCity,
  listCitiesForCountry,
} from '@/shared/lib/country/cookie-server';
import type {
  HireCityOption,
  HireCountryOption,
  HireLocationOptions,
} from '../lib/hire-location-types';
import {
  getServiceForHire,
  type ServiceForHire,
} from './get-service-for-hire';
import {
  listFiscalIdTypes,
  type FiscalIdTypeOption,
} from './list-fiscal-id-types';

export type HireBootstrap = {
  service: ServiceForHire;
  locationOptions: HireLocationOptions;
  fiscalIdTypes: FiscalIdTypeOption[];
};

export type HireBootstrapResult =
  | { ok: true; data: HireBootstrap }
  | {
      ok: false;
      reason: 'not_found' | 'no_active_countries' | 'error';
    };

type I18nRecord = Record<string, Record<string, unknown>> | null;

// Single server action that gathers every piece of data the booking
// modal needs. Next.js serializes client-invoked server actions, so a
// `Promise.all` of three actions in the client pays the SUM of round
// trips; collapsing into one action with parallel internal waves pays
// roughly the depth (3 DB hops in this case), reusing the request
// scope's React.cache for the cookie/cities helpers.
//
// Failure is encoded in the return type, never thrown — the launcher
// is a UI component on a public page and must always get a useful
// response to render (open the modal or show an alert).
export async function getHireBootstrap(
  serviceId: string,
  locale: string,
): Promise<HireBootstrapResult> {
  try {
    // Wave 1 — independent: service core, fiscal types, cookie city.
    const [service, fiscalIdTypes, selected] = await Promise.all([
      getServiceForHire(serviceId, locale),
      listFiscalIdTypes(locale),
      getSelectedCity(locale),
    ]);

    if (!service) return { ok: false, reason: 'not_found' };
    if (service.activeCountryCodes.length === 0) {
      return { ok: false, reason: 'no_active_countries' };
    }

    // Wave 2 — countries for the active codes (no second getServiceForHire).
    const supabase = createClient();
    const codes = service.activeCountryCodes.map((c) => c.toUpperCase());
    const { data: countryRows } = await supabase
      .from('countries')
      .select('id, code, i18n, sort_order')
      .in('code', codes)
      .eq('is_active', true)
      .order('sort_order', { ascending: true });

    const rows = countryRows ?? [];
    const countries: HireCountryOption[] = rows.map((r) => ({
      code: r.code.toLowerCase(),
      name: localizedField(r.i18n as I18nRecord, locale, 'name') ?? r.code,
    }));

    // Wave 3 — cities per country in parallel (was a serial for…await).
    const cityLists = await Promise.all(
      rows.map((r) => listCitiesForCountry(r.id, locale)),
    );
    const citiesByCountry: Record<string, HireCityOption[]> = {};
    rows.forEach((r, i) => {
      citiesByCountry[r.code.toLowerCase()] = cityLists[i].map((c) => ({
        id: c.id,
        name: c.name,
      }));
    });

    return {
      ok: true,
      data: {
        service,
        locationOptions: { countries, citiesByCountry, selected },
        fiscalIdTypes,
      },
    };
  } catch {
    return { ok: false, reason: 'error' };
  }
}
