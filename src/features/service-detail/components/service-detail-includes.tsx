type Props = {
  title: string;
  body: string;
};

export function ServiceDetailIncludes({ title, body }: Props) {
  return (
    <section className="bg-brand-cream px-4 py-12 md:px-6 md:py-16">
      <div className="mx-auto max-w-[1200px]">
        <h2 className="m-0 mb-4 text-2xl font-bold text-brand-text md:text-[2rem]">
          {title}
        </h2>
        <p className="whitespace-pre-line text-base leading-relaxed text-brand-text/85">
          {body}
        </p>
      </div>
    </section>
  );
}
