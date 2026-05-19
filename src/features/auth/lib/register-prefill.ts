// Pure helper that computes the initial País/Ciudad selection for the
// register form. Reuses the cookie-resolved city (set by the public
// location modal) when its country is active AND has at least one
// city available. Otherwise prefers the first active country that
// has cities — avoiding the dead-end where the form prefills a
// country whose city select is empty.

export type SelectedCityLike = {
  id: string;
  countryId: string;
};

export type CountryOption = {
  id: string;
  code: string;
  name: string;
};

export type RegisterPrefill = {
  countryId: string | null;
  cityId: string | null;
};

export function computeRegisterPrefill(
  selected: SelectedCityLike | null,
  countries: CountryOption[],
  citiesByCountry: Record<string, { id: string; name: string }[]>,
): RegisterPrefill {
  if (countries.length === 0) return { countryId: null, cityId: null };

  const hasCities = (countryId: string) =>
    (citiesByCountry[countryId]?.length ?? 0) > 0;

  // Cookie wins only when its country is active AND populated.
  if (selected) {
    const active = countries.find((c) => c.id === selected.countryId);
    if (active && hasCities(active.id)) {
      return { countryId: active.id, cityId: selected.id };
    }
  }

  // Fallback: first country with cities; if none qualify, first country
  // overall (form will render the city select disabled with a hint).
  const populated = countries.find((c) => hasCities(c.id));
  return {
    countryId: (populated ?? countries[0]).id,
    cityId: null,
  };
}
