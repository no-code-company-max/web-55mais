import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';

import { AuthCard } from '../auth-card';

describe('AuthCard', () => {
  afterEach(() => cleanup());

  it('renders the title as an h1 with the logo above', () => {
    render(
      <AuthCard title="Iniciar sesión" logoAlt="55mas">
        <p>content</p>
      </AuthCard>,
    );
    const h1 = screen.getByRole('heading', { level: 1, name: 'Iniciar sesión' });
    expect(h1).toBeInTheDocument();
    expect(screen.getByAltText('55mas')).toBeInTheDocument();
    expect(screen.getByText('content')).toBeInTheDocument();
  });

  it('renders the optional description and footer slot', () => {
    render(
      <AuthCard
        title="Crear cuenta"
        logoAlt="55mas"
        description="Completá tus datos"
        footer={<a href="#">Volver</a>}
      >
        <p>body</p>
      </AuthCard>,
    );
    expect(screen.getByText('Completá tus datos')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Volver' })).toBeInTheDocument();
  });

  it('does NOT render description paragraph when absent', () => {
    const { container } = render(
      <AuthCard title="X" logoAlt="55mas">
        <p>body</p>
      </AuthCard>,
    );
    // Only the body <p> should be present, not a description.
    const ps = container.querySelectorAll('p');
    expect(ps).toHaveLength(1);
  });
});
