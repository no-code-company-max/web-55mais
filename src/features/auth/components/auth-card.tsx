import Image from 'next/image';
import type { ReactNode } from 'react';

type Props = {
  title: string;
  logoAlt: string;
  description?: string;
  footer?: ReactNode;
  children: ReactNode;
};

// Branded card shell used by every auth page. White rounded surface
// on the (auth) layout's cream background, logo on top, title as h1,
// optional description, content slot, optional footer slot.
// Width-capped so the card stays card-shaped even on wide screens.
export function AuthCard({
  title,
  logoAlt,
  description,
  footer,
  children,
}: Props) {
  return (
    <div className="mx-auto w-full max-w-md rounded-3xl bg-white p-8 shadow-sm md:p-10">
      <div className="mb-6 flex justify-center">
        <Image
          src="/brand/logo.svg"
          alt={logoAlt}
          width={120}
          height={45}
          priority
          className="h-12 w-auto"
        />
      </div>
      <h1 className="text-center text-3xl font-bold text-brand-text">
        {title}
      </h1>
      {description && (
        <p className="mt-2 text-center text-sm text-brand-text/70">
          {description}
        </p>
      )}
      <div className="mt-8">{children}</div>
      {footer && <div className="mt-6 text-center">{footer}</div>}
    </div>
  );
}
