'use client';

import { forwardRef, useState, type ComponentPropsWithoutRef } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

type ToggleLabels = { show: string; hide: string };

type Props = Omit<ComponentPropsWithoutRef<typeof Input>, 'type'> & {
  toggleLabels: ToggleLabels;
};

// Password input with an eye-toggle that exposes its state via
// aria-pressed (the button is the "press to reveal password" control,
// which matches WAI-ARIA toggle button semantics). Forwards all
// regular Input props/refs so it slots straight into RHF.
export const PasswordInput = forwardRef<HTMLInputElement, Props>(
  function PasswordInput({ toggleLabels, className, ...inputProps }, ref) {
    const [visible, setVisible] = useState(false);
    const label = visible ? toggleLabels.hide : toggleLabels.show;

    return (
      <div className="relative">
        <Input
          {...inputProps}
          ref={ref}
          type={visible ? 'text' : 'password'}
          className={cn('pr-10', className)}
        />
        <button
          type="button"
          aria-label={label}
          aria-pressed={visible}
          onClick={() => setVisible((v) => !v)}
          className="absolute inset-y-0 right-0 flex items-center px-3 text-brand-text/50 hover:text-brand-text"
        >
          {visible ? (
            <EyeOff aria-hidden="true" className="h-4 w-4" />
          ) : (
            <Eye aria-hidden="true" className="h-4 w-4" />
          )}
        </button>
      </div>
    );
  },
);
