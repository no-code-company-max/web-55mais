import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

const getServiceMock = vi.fn();
const getOptionsMock = vi.fn();
const listFiscalMock = vi.fn();

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock('@/features/service-hire/actions/get-service-for-hire', () => ({
  getServiceForHire: (id: string, locale: string) =>
    getServiceMock(id, locale),
}));

vi.mock('@/features/service-hire/actions/get-hire-location-options', () => ({
  getHireLocationOptions: (id: string, locale: string) =>
    getOptionsMock(id, locale),
}));

vi.mock('@/features/service-hire/actions/list-fiscal-id-types', () => ({
  listFiscalIdTypes: (locale: string) => listFiscalMock(locale),
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

const locationOptions = {
  countries: [{ code: 'es', name: 'España' }],
  citiesByCountry: { es: [{ id: 'c1', name: 'Madrid' }] },
  selected: null,
};

describe('HireLauncher', () => {
  beforeEach(() => {
    getServiceMock.mockReset().mockResolvedValue(service);
    getOptionsMock.mockReset().mockResolvedValue(locationOptions);
    listFiscalMock.mockReset().mockResolvedValue([]);
  });
  afterEach(() => cleanup());

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

  it('renders the CTA and no dialog until clicked', () => {
    setup();
    expect(
      screen.getByRole('button', { name: 'Reservar ahora' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('lazily loads data and opens the modal with the wizard on click', async () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: 'Reservar ahora' }));

    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveAttribute('aria-label', 'Jardinería');
    expect(screen.getByText('wizard-stub')).toBeInTheDocument();

    expect(getServiceMock).toHaveBeenCalledWith('svc-1', 'es');
    expect(getOptionsMock).toHaveBeenCalledWith('svc-1', 'es');
    expect(listFiscalMock).toHaveBeenCalledWith('es');
  });
});
