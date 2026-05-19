import { describe, it, expect } from 'vitest';
import { orderTagInputSchema, saveOrderTagSchema } from '../schemas';

describe('orderTagInputSchema', () => {
  it('accepts input without id (create) with at least one translation', () => {
    const result = orderTagInputSchema.safeParse({
      slug: 'urgente',
      sort_order: 10,
      is_active: true,
      translations: { es: 'Urgente', en: 'Urgent' },
    });
    expect(result.success).toBe(true);
  });

  it('accepts input with existing id (update)', () => {
    const result = orderTagInputSchema.safeParse({
      id: '550e8400-e29b-41d4-a716-446655440000',
      slug: 'cliente_vip',
      sort_order: 20,
      is_active: false,
      translations: { pt: 'Cliente VIP' },
    });
    expect(result.success).toBe(true);
  });

  it('rejects empty slug', () => {
    const result = orderTagInputSchema.safeParse({
      slug: '',
      sort_order: 0,
      is_active: true,
      translations: { es: 'X' },
    });
    expect(result.success).toBe(false);
  });

  it('rejects slug with uppercase', () => {
    const result = orderTagInputSchema.safeParse({
      slug: 'Cliente-VIP',
      sort_order: 0,
      is_active: true,
      translations: { es: 'X' },
    });
    expect(result.success).toBe(false);
  });

  it('rejects slug starting with a number', () => {
    const result = orderTagInputSchema.safeParse({
      slug: '1-urgente',
      sort_order: 0,
      is_active: true,
      translations: { es: 'X' },
    });
    expect(result.success).toBe(false);
  });

  it('rejects negative sort_order', () => {
    const result = orderTagInputSchema.safeParse({
      slug: 'urgente',
      sort_order: -5,
      is_active: true,
      translations: { es: 'Urgente' },
    });
    expect(result.success).toBe(false);
  });

  it('rejects empty translations object (needs at least one)', () => {
    const result = orderTagInputSchema.safeParse({
      slug: 'urgente',
      sort_order: 0,
      is_active: true,
      translations: {},
    });
    expect(result.success).toBe(false);
  });

  it('rejects translation with empty name', () => {
    const result = orderTagInputSchema.safeParse({
      slug: 'urgente',
      sort_order: 0,
      is_active: true,
      translations: { es: '' },
    });
    expect(result.success).toBe(false);
  });

  it('rejects unknown locale key', () => {
    const result = orderTagInputSchema.safeParse({
      slug: 'urgente',
      sort_order: 0,
      is_active: true,
      translations: { es: 'Urgente', zz: 'Unknown' },
    });
    expect(result.success).toBe(false);
  });

  it('accepts all 5 supported locales', () => {
    const result = orderTagInputSchema.safeParse({
      slug: 'urgente',
      sort_order: 0,
      is_active: true,
      translations: { es: 'a', en: 'b', pt: 'c', fr: 'd', ca: 'e' },
    });
    expect(result.success).toBe(true);
  });
});

describe('saveOrderTagSchema', () => {
  it('accepts wrapped save input', () => {
    const result = saveOrderTagSchema.safeParse({
      tag: {
        slug: 'urgente',
        sort_order: 0,
        is_active: true,
        translations: { es: 'Urgente' },
      },
    });
    expect(result.success).toBe(true);
  });

  it('rejects missing tag', () => {
    const result = saveOrderTagSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});
