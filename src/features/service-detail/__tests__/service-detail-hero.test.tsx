import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';

import { ServiceDetailHero } from '../components/service-detail-hero';

const baseProps = {
  name: 'Jardinería',
  description: null,
  price: null,
  imageUrl: null,
  ctaLabel: 'Reservar ahora',
  priceFromLabel: 'Desde',
  priceUnknownLabel: 'Consultar',
};

describe('ServiceDetailHero', () => {
  afterEach(() => cleanup());

  it('renders the injected ctaSlot instead of the disabled fallback button', () => {
    render(
      <ServiceDetailHero
        {...baseProps}
        ctaSlot={
          <button type="button" data-testid="launcher">
            Reservar ahora
          </button>
        }
      />,
    );
    const slot = screen.getByTestId('launcher');
    expect(slot).toBeInTheDocument();
    expect(slot).not.toBeDisabled();
    // No fallback disabled CTA when the slot is provided.
    expect(screen.queryByRole('button', { name: 'Reservar ahora', hidden: false }))
      .not.toHaveAttribute('disabled');
  });

  it('falls back to a disabled CTA button when no ctaSlot is given', () => {
    render(<ServiceDetailHero {...baseProps} />);
    const cta = screen.getByRole('button', { name: 'Reservar ahora' });
    expect(cta).toBeDisabled();
    expect(cta).toHaveAttribute('aria-disabled', 'true');
  });
});
