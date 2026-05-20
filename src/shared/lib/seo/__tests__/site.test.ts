import { describe, it, expect, afterEach } from 'vitest';
import { resolveBaseUrl } from '../site';

const FALLBACK = 'https://55mas.es';
const original = process.env.NEXT_PUBLIC_SITE_URL;

afterEach(() => {
  if (original === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
  else process.env.NEXT_PUBLIC_SITE_URL = original;
});

describe('resolveBaseUrl', () => {
  it('returns the fallback when the env var is undefined', () => {
    delete process.env.NEXT_PUBLIC_SITE_URL;
    expect(resolveBaseUrl()).toBe(FALLBACK);
  });

  it('returns the fallback when the env var is an empty string', () => {
    // Regression: Vercel env vars set to "" used to short-circuit the
    // `??` fallback and crash `new URL("")` at build time.
    process.env.NEXT_PUBLIC_SITE_URL = '';
    expect(resolveBaseUrl()).toBe(FALLBACK);
  });

  it('returns the fallback when the env var is only whitespace', () => {
    process.env.NEXT_PUBLIC_SITE_URL = '   ';
    expect(resolveBaseUrl()).toBe(FALLBACK);
  });

  it('returns the fallback when the env var lacks an http(s) scheme', () => {
    process.env.NEXT_PUBLIC_SITE_URL = 'my-55mas.vercel.app';
    expect(resolveBaseUrl()).toBe(FALLBACK);
  });

  it('respects a valid https URL', () => {
    process.env.NEXT_PUBLIC_SITE_URL = 'https://my-55mas.vercel.app';
    expect(resolveBaseUrl()).toBe('https://my-55mas.vercel.app');
  });

  it('strips a trailing slash', () => {
    process.env.NEXT_PUBLIC_SITE_URL = 'https://my-55mas.vercel.app/';
    expect(resolveBaseUrl()).toBe('https://my-55mas.vercel.app');
  });

  it('trims surrounding whitespace', () => {
    process.env.NEXT_PUBLIC_SITE_URL = '  https://my-55mas.vercel.app  ';
    expect(resolveBaseUrl()).toBe('https://my-55mas.vercel.app');
  });
});
