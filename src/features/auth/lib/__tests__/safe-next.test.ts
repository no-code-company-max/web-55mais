import { describe, it, expect } from 'vitest';
import { safeNext } from '../safe-next';

const DEFAULT_ES = '/es/mi-cuenta';
const DEFAULT_EN = '/en/mi-cuenta';

describe('safeNext', () => {
  it('returns the default localized path when value is missing', () => {
    expect(safeNext(null, 'es')).toBe(DEFAULT_ES);
    expect(safeNext(undefined, 'en')).toBe(DEFAULT_EN);
    expect(safeNext('', 'es')).toBe(DEFAULT_ES);
  });

  it('accepts internal paths starting with /', () => {
    expect(safeNext('/es/servicios/jardineria', 'es')).toBe(
      '/es/servicios/jardineria',
    );
    expect(safeNext('/mi-cuenta', 'en')).toBe('/mi-cuenta');
  });

  it('rejects protocol-relative URLs (//evil.com)', () => {
    expect(safeNext('//evil.com', 'es')).toBe(DEFAULT_ES);
    expect(safeNext('//evil.com/path', 'es')).toBe(DEFAULT_ES);
  });

  it('rejects absolute external URLs', () => {
    expect(safeNext('https://evil.com', 'es')).toBe(DEFAULT_ES);
    expect(safeNext('http://evil.com', 'es')).toBe(DEFAULT_ES);
    expect(safeNext('javascript:alert(1)', 'es')).toBe(DEFAULT_ES);
  });

  it('rejects backslash-escaped paths (\\\\evil.com)', () => {
    expect(safeNext('/\\evil.com', 'es')).toBe(DEFAULT_ES);
    expect(safeNext('\\\\evil.com', 'es')).toBe(DEFAULT_ES);
  });

  it('rejects values that do not start with /', () => {
    expect(safeNext('mi-cuenta', 'es')).toBe(DEFAULT_ES);
    expect(safeNext('?next=evil', 'es')).toBe(DEFAULT_ES);
  });

  it('rejects blocklisted internal prefixes (/api, /_next, /_vercel, /auth)', () => {
    expect(safeNext('/api/admin/delete-user', 'es')).toBe(DEFAULT_ES);
    expect(safeNext('/_next/static/x', 'es')).toBe(DEFAULT_ES);
    expect(safeNext('/_vercel/insights', 'es')).toBe(DEFAULT_ES);
    expect(safeNext('/auth/callback?code=abc', 'es')).toBe(DEFAULT_ES);
  });
});
