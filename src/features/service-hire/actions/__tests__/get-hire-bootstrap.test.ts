import { describe, it, expect, vi, beforeEach } from 'vitest';

// Composed dependencies are mocked at module boundary. Bootstrap is the
// only unit under test; its job is to orchestrate them in one request
// scope with parallel waves and a typed result. Stubbing the deps gives
// us a clean lens on that orchestration (especially the G3 regression
// guard: getServiceForHire must be called exactly once per bootstrap
// invocation — never twice as in the pre-consolidation bug).
const getServiceForHireMock = vi.fn();
const listFiscalIdTypesMock = vi.fn();
const getSelectedCityMock = vi.fn();
const listCitiesForCountryMock = vi.fn();

vi.mock('../get-service-for-hire', () => ({
  getServiceForHire: (id: string, locale: string) =>
    getServiceForHireMock(id, locale),
}));

vi.mock('../list-fiscal-id-types', () => ({
  listFiscalIdTypes: (locale: string) => listFiscalIdTypesMock(locale),
}));

vi.mock('@/shared/lib/country/cookie-server', () => ({
  getSelectedCity: (locale: string) => getSelectedCityMock(locale),
  listCitiesForCountry: (countryId: string, locale: string) =>
    listCitiesForCountryMock(countryId, locale),
}));

// Chainable supabase builder for the countries query. Pattern mirrors
// the load-home-services test harness: every chain method returns the
// builder; awaiting it resolves to whatever mockResolve currently returns.
const countriesResolve = vi.fn();
function buildChain() {
  const b: Record<string, unknown> = {};
  b.select = vi.fn(() => b);
  b.in = vi.fn(() => b);
  b.eq = vi.fn(() => b);
  b.order = vi.fn(() => b);
  (b as { then: (cb: (v: unknown) => unknown) => unknown }).then = (
    cb: (v: unknown) => unknown,
  ) => cb(countriesResolve());
  return b;
}
const mockFrom = vi.fn(() => buildChain());

vi.mock('@/lib/supabase/server', () => ({
  createClient: () => ({ from: mockFrom }),
}));

import { getHireBootstrap } from '../get-hire-bootstrap';

const baseService = {
  id: 'svc-1',
  slug: 'jardineria',
  name: 'Jardinería',
  description: null,
  questions: [],
  assignedGroups: [],
  activeCountryCodes: ['es', 'pt'],
  countryTimezones: { es: 'Europe/Madrid', pt: 'Europe/Lisbon' },
};

const baseFiscalTypes = [
  { id: 'fit-1', code: 'NIE', label: 'NIE' },
  { id: 'fit-2', code: 'NIF', label: 'NIF' },
];

const baseSelected = {
  id: 'city-mad',
  slug: 'madrid',
  name: 'Madrid',
  countryId: 'country-es',
  countryCode: 'ES',
};

const countryRowsES_PT = [
  {
    id: 'country-es',
    code: 'ES',
    i18n: { es: { name: 'España' }, en: { name: 'Spain' } },
    sort_order: 1,
  },
  {
    id: 'country-pt',
    code: 'PT',
    i18n: { es: { name: 'Portugal' }, en: { name: 'Portugal' } },
    sort_order: 2,
  },
];

describe('getHireBootstrap', () => {
  beforeEach(() => {
    getServiceForHireMock.mockReset();
    listFiscalIdTypesMock.mockReset();
    getSelectedCityMock.mockReset();
    listCitiesForCountryMock.mockReset();
    countriesResolve.mockReset();
    mockFrom.mockClear();
  });

  it('happy path: returns ok:true with composed service/locationOptions/fiscalIdTypes', async () => {
    getServiceForHireMock.mockResolvedValue(baseService);
    listFiscalIdTypesMock.mockResolvedValue(baseFiscalTypes);
    getSelectedCityMock.mockResolvedValue(baseSelected);
    countriesResolve.mockReturnValue({ data: countryRowsES_PT, error: null });
    listCitiesForCountryMock.mockImplementation(async (countryId: string) => {
      if (countryId === 'country-es')
        return [{ id: 'city-mad', slug: 'madrid', name: 'Madrid' }];
      if (countryId === 'country-pt')
        return [{ id: 'city-lis', slug: 'lisbon', name: 'Lisboa' }];
      return [];
    });

    const res = await getHireBootstrap('svc-1', 'es');

    expect(res.ok).toBe(true);
    if (!res.ok) throw new Error('expected ok');
    expect(res.data.service).toBe(baseService);
    expect(res.data.fiscalIdTypes).toBe(baseFiscalTypes);
    expect(res.data.locationOptions.selected).toBe(baseSelected);
    expect(res.data.locationOptions.countries).toEqual([
      { code: 'es', name: 'España' },
      { code: 'pt', name: 'Portugal' },
    ]);
    expect(res.data.locationOptions.citiesByCountry).toEqual({
      es: [{ id: 'city-mad', name: 'Madrid' }],
      pt: [{ id: 'city-lis', name: 'Lisboa' }],
    });
  });

  it('not_found: service is null', async () => {
    getServiceForHireMock.mockResolvedValue(null);
    listFiscalIdTypesMock.mockResolvedValue(baseFiscalTypes);
    getSelectedCityMock.mockResolvedValue(null);

    const res = await getHireBootstrap('svc-x', 'es');

    expect(res).toEqual({ ok: false, reason: 'not_found' });
    // No country / city work should happen on this path.
    expect(mockFrom).not.toHaveBeenCalled();
    expect(listCitiesForCountryMock).not.toHaveBeenCalled();
  });

  it('no_active_countries: service has zero active country codes', async () => {
    getServiceForHireMock.mockResolvedValue({
      ...baseService,
      activeCountryCodes: [],
    });
    listFiscalIdTypesMock.mockResolvedValue(baseFiscalTypes);
    getSelectedCityMock.mockResolvedValue(null);

    const res = await getHireBootstrap('svc-1', 'es');

    expect(res).toEqual({ ok: false, reason: 'no_active_countries' });
    // Bootstrap must short-circuit before the countries query / city loop.
    expect(mockFrom).not.toHaveBeenCalled();
    expect(listCitiesForCountryMock).not.toHaveBeenCalled();
  });

  it('error: any underlying throw resolves to ok:false reason:"error" (never propagates)', async () => {
    getServiceForHireMock.mockResolvedValue(baseService);
    listFiscalIdTypesMock.mockRejectedValue(new Error('boom'));
    getSelectedCityMock.mockResolvedValue(null);

    const res = await getHireBootstrap('svc-1', 'es');

    expect(res).toEqual({ ok: false, reason: 'error' });
  });

  it('G3 — getServiceForHire is composed exactly once per bootstrap (no duplicate fetch)', async () => {
    getServiceForHireMock.mockResolvedValue(baseService);
    listFiscalIdTypesMock.mockResolvedValue(baseFiscalTypes);
    getSelectedCityMock.mockResolvedValue(baseSelected);
    countriesResolve.mockReturnValue({ data: countryRowsES_PT, error: null });
    listCitiesForCountryMock.mockResolvedValue([]);

    await getHireBootstrap('svc-1', 'es');

    expect(getServiceForHireMock).toHaveBeenCalledTimes(1);
  });

  it('cities query runs per active country (one call per country, results stitched by lowercase code)', async () => {
    getServiceForHireMock.mockResolvedValue(baseService);
    listFiscalIdTypesMock.mockResolvedValue(baseFiscalTypes);
    getSelectedCityMock.mockResolvedValue(null);
    countriesResolve.mockReturnValue({ data: countryRowsES_PT, error: null });
    listCitiesForCountryMock.mockResolvedValue([]);

    await getHireBootstrap('svc-1', 'es');

    expect(listCitiesForCountryMock).toHaveBeenCalledTimes(2);
    expect(listCitiesForCountryMock).toHaveBeenCalledWith('country-es', 'es');
    expect(listCitiesForCountryMock).toHaveBeenCalledWith('country-pt', 'es');
  });
});
