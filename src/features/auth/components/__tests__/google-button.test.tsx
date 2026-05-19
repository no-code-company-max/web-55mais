import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';

import { GoogleButton } from '../google-button';

describe('GoogleButton', () => {
  afterEach(() => cleanup());

  it('renders disabled with the label and the soon-tooltip via title', () => {
    render(<GoogleButton label="Iniciar sesión con Google" soonLabel="Próximamente" />);
    const button = screen.getByRole('button', { name: /Iniciar sesión con Google/ });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-disabled', 'true');
    expect(button).toHaveAttribute('title', 'Próximamente');
  });
});
