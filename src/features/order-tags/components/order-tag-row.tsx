'use client';

import { useTranslations } from 'next-intl';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';
import { slugify } from '@/shared/lib/slugify';
import type { OrderTagInput } from '../types';

type Props = {
  tag: OrderTagInput;
  locale: string;
  isPrimary: boolean;
  onChange: (tag: OrderTagInput) => void;
  onRemove: () => void;
};

export function OrderTagRow({ tag, locale, isPrimary, onChange, onRemove }: Props) {
  const t = useTranslations('AdminOrderTags');

  return (
    <div className="flex items-center gap-2">
      <Input
        value={tag.translations[locale] ?? ''}
        onChange={(e) => {
          const name = e.target.value;
          const updated: OrderTagInput = {
            ...tag,
            translations: { ...tag.translations, [locale]: name },
          };
          if (isPrimary) updated.slug = slugify(name);
          onChange(updated);
        }}
        placeholder={t('namePlaceholder')}
        className="h-8 flex-1 text-sm"
      />
      <label className="flex items-center gap-1 text-xs whitespace-nowrap">
        <input
          type="checkbox"
          checked={tag.is_active}
          onChange={(e) => onChange({ ...tag, is_active: e.target.checked })}
          className="h-3 w-3"
          disabled={!isPrimary}
        />
        {t('active')}
      </label>
      {isPrimary && (
        <Button type="button" variant="ghost" size="icon-xs" onClick={onRemove}>
          <X />
        </Button>
      )}
    </div>
  );
}
