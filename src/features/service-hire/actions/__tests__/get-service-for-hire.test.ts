import { describe, it, expect, vi, beforeEach } from 'vitest';

// Per-table chainable builders. Each call to `from(table)` returns a
// builder whose terminal `await` resolves to the entry tableResolves
// has for that table (mock per test). This lets us drive the three
// queries (services / service_countries / service_subtype_group_
// assignments) independently and assert they each ran.
const tableResolves: Record<string, () => unknown> = {};
const tableCalls: Record<string, number> = {};

function buildChain(table: string) {
  tableCalls[table] = (tableCalls[table] ?? 0) + 1;
  const b: Record<string, unknown> = {};
  const passthrough = vi.fn(() => b);
  b.select = passthrough;
  b.eq = passthrough;
  b.in = passthrough;
  b.order = passthrough;
  b.maybeSingle = vi.fn(() => Promise.resolve(tableResolves[table]?.()));
  (b as { then: (cb: (v: unknown) => unknown) => unknown }).then = (
    cb: (v: unknown) => unknown,
  ) => cb(tableResolves[table]?.());
  return b;
}

const mockFrom = vi.fn((table: string) => buildChain(table));

vi.mock('@/lib/supabase/server', () => ({
  createClient: () => ({ from: mockFrom }),
}));

import { getServiceForHire } from '../get-service-for-hire';

describe('getServiceForHire', () => {
  beforeEach(() => {
    for (const k of Object.keys(tableResolves)) delete tableResolves[k];
    for (const k of Object.keys(tableCalls)) delete tableCalls[k];
    mockFrom.mockClear();
  });

  it('returns null when the service row is missing (not published)', async () => {
    tableResolves.services = () => ({ data: null, error: null });
    // Other tables resolve to empty so anything still fired stays harmless.
    tableResolves.service_countries = () => ({ data: [], error: null });
    tableResolves.service_subtype_group_assignments = () => ({
      data: [],
      error: null,
    });

    const result = await getServiceForHire('svc-1', 'es');
    expect(result).toBeNull();
  });

  it('happy: maps activeCountryCodes (active only) and countryTimezones by lowercase code', async () => {
    tableResolves.services = () => ({
      data: {
        id: 'svc-1',
        slug: 'jardineria',
        i18n: {
          es: { name: 'Jardinería', description: 'Riego y poda.' },
          en: { name: 'Gardening', description: 'Watering and pruning.' },
        },
        questions: [],
      },
      error: null,
    });
    tableResolves.service_countries = () => ({
      data: [
        {
          country_id: 'country-es',
          countries: { code: 'ES', is_active: true, timezone: 'Europe/Madrid' },
        },
        {
          country_id: 'country-pt',
          countries: { code: 'PT', is_active: true, timezone: 'Europe/Lisbon' },
        },
        {
          country_id: 'country-inactive',
          countries: { code: 'XX', is_active: false, timezone: 'UTC' },
        },
      ],
      error: null,
    });
    tableResolves.service_subtype_group_assignments = () => ({
      data: [],
      error: null,
    });

    const result = await getServiceForHire('svc-1', 'es');

    expect(result).not.toBeNull();
    expect(result!.id).toBe('svc-1');
    expect(result!.slug).toBe('jardineria');
    expect(result!.name).toBe('Jardinería');
    expect(result!.description).toBe('Riego y poda.');
    expect(result!.activeCountryCodes).toEqual(['ES', 'PT']);
    expect(result!.countryTimezones).toEqual({
      es: 'Europe/Madrid',
      pt: 'Europe/Lisbon',
    });
  });
});
