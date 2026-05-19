import { handleAuthCallback } from '@/features/auth';
import type { NextRequest } from 'next/server';

// /auth/callback lives OUTSIDE the [locale] segment so the next-intl
// middleware doesn't reshape the request and strip the sensitive
// `?code=` (plan C1). The actual exchange + redirect lives in the
// auth feature; this file is intentionally a thin shell.
export async function GET(request: NextRequest) {
  return handleAuthCallback(request);
}
