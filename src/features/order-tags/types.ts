export const ORDER_TAG_LOCALES = ['es', 'en', 'pt', 'fr', 'ca'] as const;
export type OrderTagLocale = (typeof ORDER_TAG_LOCALES)[number];

export type OrderTag = {
  id: string;
  slug: string;
  sort_order: number;
  is_active: boolean;
};

export type OrderTagWithTranslations = OrderTag & {
  translations: Record<string, string>;
};

export type OrderTagInput = {
  id?: string;
  slug: string;
  sort_order: number;
  is_active: boolean;
  translations: Record<string, string>;
};

export type SaveOrderTagInput = {
  tag: OrderTagInput;
};
