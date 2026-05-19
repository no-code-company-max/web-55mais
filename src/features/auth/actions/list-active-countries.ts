'use server';

import { createClient } from '@/lib/supabase/server';
import { localizedField } from '@/shared/lib/i18n/localize';

export type ActiveCountry = {
  id: string;
  code: string; // lowercased ISO-2
  name: string;
};

type I18nRecord = Record<string, Record<string, unknown>> | null;

// All active countries, localized, ordered by sort_order. Used by the
// register form's País select. Plain server action; cheap query.
export async function listActiveCountries(
  locale: string,
): Promise<ActiveCountry[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from('countries')
    .select('id, code, i18n')
    .eq('is_active', true)
    .order('sort_order', { ascending: true });

  return (data ?? []).map((r) => ({
    id: r.id,
    code: r.code.toLowerCase(),
    name: localizedField(r.i18n as I18nRecord, locale, 'name') ?? r.code,
  }));
}
