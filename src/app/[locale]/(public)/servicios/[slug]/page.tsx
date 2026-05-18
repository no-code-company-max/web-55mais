import { notFound } from 'next/navigation';
import { unstable_setRequestLocale, getTranslations } from 'next-intl/server';
import {
  loadServiceDetail,
  ServiceDetailHero,
  ServiceDetailIncludes,
  ServiceDetailBenefits,
} from '@/features/service-detail';
import { PublicFaqAccordion } from '@/features/faqs/components/public-faq-accordion';
import { HomeTestimonials } from '@/features/public-home/components/home-testimonials';
import { JoinCta } from '@/shared/components/marketing/join-cta';
import { buildPublicMetadata, JsonLdScript, serviceJsonLd } from '@/shared/lib/seo';

type Props = {
  params: { locale: string; slug: string };
};

export async function generateMetadata({ params: { locale, slug } }: Props) {
  const svc = await loadServiceDetail(locale, slug);
  if (!svc) return {};
  const t = await getTranslations({ locale, namespace: 'serviceDetail.meta' });
  return buildPublicMetadata({
    locale,
    path: `/servicios/${slug}`,
    title: t('titleTemplate', { name: svc.name }),
    description: svc.metaDescription ?? t('descriptionFallback'),
    ogImage: svc.coverImageUrl ?? undefined,
  });
}

export default async function ServiceDetailPage({
  params: { locale, slug },
}: Props) {
  unstable_setRequestLocale(locale);
  const svc = await loadServiceDetail(locale, slug);
  if (!svc) notFound();

  const t = await getTranslations('serviceDetail');

  const jsonLd = serviceJsonLd({
    name: svc.name,
    description: svc.metaDescription ?? undefined,
    url: `/servicios/${svc.slug}`,
    imageUrl: svc.coverImageUrl ?? undefined,
    price: svc.price?.amount,
    priceCurrency: svc.price?.currency,
  });

  return (
    <>
      <JsonLdScript id="ld-service-detail" data={jsonLd} />

      <ServiceDetailHero
        name={svc.name}
        subtitle={svc.heroSubtitle}
        price={svc.price}
        imageUrl={svc.coverImageUrl}
        ctaLabel={t('cta.reserve')}
        priceFromLabel={t('price.from')}
        priceUnknownLabel={t('price.unknown')}
      />

      {svc.includes && (
        <ServiceDetailIncludes
          title={t('sections.includes')}
          body={svc.includes}
        />
      )}

      {(svc.benefits.length > 0 || svc.guarantees.length > 0) && (
        <ServiceDetailBenefits
          benefits={svc.benefits}
          guarantees={svc.guarantees}
          benefitsTitle={t('sections.benefits')}
          guaranteesTitle={t('sections.guarantees')}
        />
      )}

      {svc.faqs.length > 0 && (
        <section className="bg-brand-cream px-4 py-12 md:px-6 md:py-16">
          <div className="mx-auto max-w-[820px]">
            <h2 className="m-0 mb-6 text-center text-2xl font-bold text-brand-text md:text-[2rem]">
              {t('sections.faqs')}
            </h2>
            <PublicFaqAccordion items={svc.faqs} />
          </div>
        </section>
      )}

      <HomeTestimonials locale={locale} />

      <JoinCta
        title={t('cta.joinTitle')}
        buttons={[
          {
            label: t('cta.joinButton'),
            href: '/registro/talento',
            variant: 'mustard',
          },
        ]}
      />
    </>
  );
}
