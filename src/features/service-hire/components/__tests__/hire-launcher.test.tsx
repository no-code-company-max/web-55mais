import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

const bootstrapMock = vi.fn();

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock('@/features/service-hire/actions/get-hire-bootstrap', () => ({
  getHireBootstrap: (id: string, locale: string) => bootstrapMock(id, locale),
}));

vi.mock('@/features/service-hire/components/wizard', () => ({
  ServiceHireWizard: () => <div>wizard-stub</div>,
}));

import { HireLauncher } from '../hire-launcher';

const service = {
  id: 'svc-1',
  slug: 'jardineria',
  name: 'Jardinería',
  description: null,
  questions: [],
  assignedGroups: [],
  activeCountryCodes: ['es'],
  countryTimezones: { es: 'Europe/Madrid' },
};

const okData = {
  service,
  locationOptions: {
    countries: [{ code: 'es', name: 'España' }],
    citiesByCountry: { es: [{ id: 'c1', name: 'Madrid' }] },
    selected: null,
  },
  fiscalIdTypes: [],
};

function setup() {
  return render(
    <HireLauncher
      serviceId="svc-1"
      serviceName="Jardinería"
      locale="es"
      ctaLabel="Reservar ahora"
    />,
  );
}

describe('HireLauncher', () => {
  beforeEach(() => bootstrapMock.mockReset());
  afterEach(() => cleanup());

  it('renders the CTA with no dialog and no alert until clicked', () => {
    setup();
    expect(
      screen.getByRole('button', { name: 'Reservar ahora' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('happy path: lazily loads via getHireBootstrap and opens the modal with the wizard', async () => {
    bootstrapMock.mockResolvedValue({ ok: true, data: okData });
    setup();
    fireEvent.click(screen.getByRole('button', { name: 'Reservar ahora' }));

    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveAttribute('aria-label', 'Jardinería');
    expect(screen.getByText('wizard-stub')).toBeInTheDocument();
    expect(bootstrapMock).toHaveBeenCalledWith('svc-1', 'es');
    expect(bootstrapMock).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('not_found: shows inline alert, keeps modal closed, button re-enabled', async () => {
    bootstrapMock.mockResolvedValue({ ok: false, reason: 'not_found' });
    setup();
    fireEvent.click(screen.getByRole('button', { name: 'Reservar ahora' }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('ServiceHire.unavailableNotFound');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Reservar ahora' }),
    ).not.toBeDisabled();
  });

  it('no_active_countries: shows the area-unavailable alert', async () => {
    bootstrapMock.mockResolvedValue({
      ok: false,
      reason: 'no_active_countries',
    });
    setup();
    fireEvent.click(screen.getByRole('button', { name: 'Reservar ahora' }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('ServiceHire.unavailableNoCountries');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('error: shows the generic retry alert', async () => {
    bootstrapMock.mockResolvedValue({ ok: false, reason: 'error' });
    setup();
    fireEvent.click(screen.getByRole('button', { name: 'Reservar ahora' }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('ServiceHire.unavailableGeneric');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
