'use client';

import { Button } from '@/components/ui/button';
import type { ServiceHireHints } from '../../lib/build-hints';
import { TOTAL_STEPS, type WizardStep } from '../../lib/step-validation';

type Props = {
  step: WizardStep;
  isPending: boolean;
  onCancel: () => void;
  onBack: () => void;
  onNext: () => void;
  onConfirm: () => void;
  hints: ServiceHireHints['wizard'];
};

// Cancelar (always) / Atrás (step > 1) / Siguiente (steps 1-4) or
// Confirmar (step 5). Siguiente stays enabled and validates on click
// so the user sees *why* a step is blocked instead of a dead button;
// Confirmar revalidates everything and jumps to the first broken step.
export function WizardFooter({
  step,
  isPending,
  onCancel,
  onBack,
  onNext,
  onConfirm,
  hints,
}: Props) {
  const isLast = step === TOTAL_STEPS;

  return (
    <div className="mt-6 flex items-center justify-between gap-3">
      <Button type="button" variant="ghost" onClick={onCancel}>
        {hints.cancel}
      </Button>

      <div className="flex gap-2">
        {step > 1 && (
          <Button type="button" variant="outline" onClick={onBack}>
            {hints.back}
          </Button>
        )}
        {isLast ? (
          <Button type="button" onClick={onConfirm} disabled={isPending}>
            {isPending ? '…' : hints.confirm}
          </Button>
        ) : (
          <Button type="button" onClick={onNext}>
            {hints.next}
          </Button>
        )}
      </div>
    </div>
  );
}
