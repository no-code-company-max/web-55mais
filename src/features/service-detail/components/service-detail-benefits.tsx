type Props = {
  benefits: string[];
  guarantees: string[];
  benefitsTitle: string;
  guaranteesTitle: string;
};

// Benefits + guarantees in a single section, two columns on desktop.
// A column renders only when its list is non-empty (a single non-empty
// list → one full-width column, never an empty one).
export function ServiceDetailBenefits({
  benefits,
  guarantees,
  benefitsTitle,
  guaranteesTitle,
}: Props) {
  const columns = [
    { title: benefitsTitle, items: benefits },
    { title: guaranteesTitle, items: guarantees },
  ].filter((c) => c.items.length > 0);

  if (columns.length === 0) return null;

  return (
    <section className="bg-white px-4 py-12 md:px-6 md:py-16">
      <div
        className={`mx-auto grid max-w-[1200px] gap-10 ${
          columns.length === 2 ? 'md:grid-cols-2' : ''
        }`}
      >
        {columns.map((col) => (
          <div key={col.title}>
            <h2 className="m-0 mb-5 text-2xl font-bold text-brand-text md:text-[2rem]">
              {col.title}
            </h2>
            <ul className="grid gap-3">
              {col.items.map((item) => (
                <li
                  key={item}
                  className="flex items-start gap-2.5 text-base text-brand-text/85"
                >
                  <CheckIcon className="mt-1 h-4 w-4 flex-shrink-0 text-brand-red" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden="true"
      className={className}
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M16.704 5.296a1 1 0 010 1.408l-7.5 7.5a1 1 0 01-1.408 0l-3.5-3.5a1 1 0 011.408-1.408L8.5 12.092l6.796-6.796a1 1 0 011.408 0z"
      />
    </svg>
  );
}
