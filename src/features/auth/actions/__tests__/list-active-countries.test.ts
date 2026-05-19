import { describe, it, expect, vi, beforeEach } from 'vitest';

const queryResolve = vi.fn();

function buildChain() {
  const b: Record<string, unknown> = {};
  b.select = vi.fn(() => b);
  b.eq = vi.fn(() => b);
  b.order = vi.fn(() => b);
  (b as { then: (cb: (v: unknown) => unknown) => unknown }).then = (
    cb: (v: unknown) => unknown,
  ) => cb(queryResolve());
  return b;
}

const mockFrom = vi.fn(() => buildChain());

vi.mock('@/lib/supabase/server', () => ({
  createClient: () => ({ from: mockFrom }),
}));

import { listActiveCountries } from '../list-active-countries';

describe('listActiveCountries', () => {
  beforeEach(() => {
    queryResolve.mockReset();
    mockFrom.mockClear();
  });

  it('returns localized active countries by sort_order', async () => {
    queryResolve.mockReturnValue({
      data: [
        {
          id: 'c-es',
          code: 'ES',
          i18n: { es: { name: 'España' }, en: { name: 'Spain' } },
        },
        {
          id: 'c-pt',
          code: 'PT',
          i18n: { es: { name: 'Portugal' }, en: { name: 'Portugal' } },
        },
      ],
      error: null,
    });
    const result = await listActiveCountries('es');
    expect(result).toEqual([
      { id: 'c-es', code: 'es', name: 'España' },
      { id: 'c-pt', code: 'pt', name: 'Portugal' },
    ]);
  });

  it('falls back to code when locale name missing', async () => {
    queryResolve.mockReturnValue({
      data: [{ id: 'c-es', code: 'ES', i18n: {} }],
      error: null,
    });
    const result = await listActiveCountries('en');
    expect(result[0].name).toBe('ES');
  });

  it('returns empty array when query returns null', async () => {
    queryResolve.mockReturnValue({ data: null, error: null });
    expect(await listActiveCountries('es')).toEqual([]);
  });
});
