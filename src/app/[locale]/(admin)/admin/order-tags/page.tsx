import { getTranslations, unstable_setRequestLocale } from 'next-intl/server';
import { listTags } from '@/features/order-tags/actions/list-tags';
import { PageHeader } from '@/shared/components/page-header';
import { OrderTagsEditor } from '@/features/order-tags/components/order-tags-editor';

type Props = { params: { locale: string } };

export default async function OrderTagsPage({ params: { locale } }: Props) {
  unstable_setRequestLocale(locale);
  const t = await getTranslations('AdminOrderTags');
  const tags = await listTags();

  return (
    <div className="p-8">
      <PageHeader title={t('title')} />
      <OrderTagsEditor initialTags={tags} />
    </div>
  );
}
