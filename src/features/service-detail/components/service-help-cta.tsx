type Props = {
  title: string;
  subtitle: string;
  buttonLabel: string;
};

// Closing help CTA on the service detail page (replaces the newsletter
// band for this route). Plain cream background, no decorations. The
// button is intentionally inert (no contact flow wired yet).
export function ServiceHelpCta({ title, subtitle, buttonLabel }: Props) {
  return (
    <section
      className="bg-brand-cream px-4 py-20 md:py-28"
      aria-label={title}
    >
      <div className="mx-auto max-w-[720px] text-center">
        <h2 className="m-0 mb-5 text-[1.8rem] font-bold leading-[1.35] text-brand-text md:text-[2.2rem]">
          {title}
        </h2>
        <p className="mx-auto mb-9 max-w-[560px] text-base text-brand-text/75 md:text-lg">
          {subtitle}
        </p>
        <button
          type="button"
          disabled
          aria-disabled="true"
          className="
            inline-flex items-center justify-center
            rounded-full border-2 border-brand-mustard bg-white px-8 py-3.5
            text-base font-semibold text-brand-text
            opacity-60 md:whitespace-nowrap
          "
        >
          {buttonLabel}
        </button>
      </div>
    </section>
  );
}
