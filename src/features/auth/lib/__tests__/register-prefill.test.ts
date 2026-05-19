import { describe, it, expect } from 'vitest';
import { computeRegisterPrefill } from '../register-prefill';

const countries = [
  { id: 'country-es', code: 'es', name: 'España' },
  { id: 'country-pt', code: 'pt', name: 'Portugal' },
  { id: 'country-fr', code: 'fr', name: 'Francia' },
];

const citiesByCountry: Record<string, { id: string; name: string }[]> = {
  'country-es': [{ id: 'city-mad', name: 'Madrid' }],
  'country-pt': [{ id: 'city-lis', name: 'Lisboa' }],
  'country-fr': [], // no cities active
};

const selectedMad = {
  id: 'city-mad',
  slug: 'madrid',
  name: 'Madrid',
  countryId: 'country-es',
  countryCode: 'ES',
};

const selectedFr = {
  id: 'city-paris',
  slug: 'paris',
  name: 'Paris',
  countryId: 'country-fr',
  countryCode: 'FR',
};

describe('computeRegisterPrefill', () => {
  it('uses cookie selection when its country has cities', () => {
    expect(
      computeRegisterPrefill(selectedMad, countries, citiesByCountry),
    ).toEqual({ countryId: 'country-es', cityId: 'city-mad' });
  });

  it('falls back to first country with cities when cookie country has none (G17)', () => {
    // Cookie points to FR which has 0 active cities — prefer ES (first
    // with cities) rather than land the user on a dead-end UX.
    expect(
      computeRegisterPrefill(selectedFr, countries, citiesByCountry),
    ).toEqual({ countryId: 'country-es', cityId: null });
  });

  it('falls back to first country with cities when no cookie', () => {
    expect(
      computeRegisterPrefill(null, countries, citiesByCountry),
    ).toEqual({ countryId: 'country-es', cityId: null });
  });

  it('falls back to the first country if NONE have cities', () => {
    const emptyMap = {
      'country-es': [],
      'country-pt': [],
      'country-fr': [],
    };
    expect(computeRegisterPrefill(null, countries, emptyMap)).toEqual({
      countryId: 'country-es',
      cityId: null,
    });
  });

  it('returns null countryId when there are no active countries', () => {
    expect(computeRegisterPrefill(null, [], {})).toEqual({
      countryId: null,
      cityId: null,
    });
  });

  it('ignores cookie pointing to an inactive country (not in active list)', () => {
    const orphan = { ...selectedMad, countryId: 'country-XX' };
    expect(
      computeRegisterPrefill(orphan, countries, citiesByCountry),
    ).toEqual({ countryId: 'country-es', cityId: null });
  });
});
