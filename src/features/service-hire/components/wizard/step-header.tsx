'use client';

import { forwardRef } from 'react';
import type { ServiceHireHints } from '../../lib/build-hints';
import { TOTAL_STEPS, type WizardStep } from '../../lib/step-validation';

type Props = {
  step: WizardStep;
  hints: ServiceHireHints['wizard'];
};

// Branded wizard header: persistent title + intro, a non-clickable
// numbered progress indicator, an aria-live "Paso N de 5" region and
// the per-step heading. The heading is the focus target the wizard
// moves focus to on every step change (forwarded ref, tabIndex -1).
export const StepHeader = forwardRef<HTMLHeadingElement, Props>(
  function StepHeader({ step, hints }, ref) {
    const steps = Array.from({ length: TOTAL_STEPS }, (_, i) => i + 1);

    return (
      <div className="mb-5">
        <h2 className="text-xl font-bold text-brand-text">{hints.title}</h2>
        <p className="mt-1 text-sm text-brand-text/70">{hints.intro}</p>

        <ol
          aria-hidden="true"
          className="mt-4 flex items-center gap-2 text-xs font-semibold"
        >
          {steps.map((n) => (
            <li
              key={n}
              className={`flex h-7 w-7 items-center justify-center rounded-full border ${
                n === step
                  ? 'border-brand-text bg-brand-text text-white'
                  : n < step
                    ? 'border-brand-text/40 bg-brand-text/10 text-brand-text/70'
                    : 'border-brand-text/20 text-brand-text/40'
              }`}
            >
              {n}
            </li>
          ))}
        </ol>

        <p aria-live="polite" className="mt-3 text-xs text-brand-text/60">
          {hints.stepProgress(step)}
        </p>

        <h3
          ref={ref}
          tabIndex={-1}
          className="mt-1 text-base font-semibold text-brand-text outline-none"
        >
          {hints.steps[step - 1]}
        </h3>
      </div>
    );
  },
);
