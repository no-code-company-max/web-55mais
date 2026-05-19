import { z } from 'zod';

// Email is normalized at parse time so every downstream consumer (and
// Supabase, which is case-sensitive in some setups) sees the canonical
// form. Centralising the transform here means actions can trust the
// shape they receive.
export const emailField = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.string().email());

// Minimum 8 chars overrides Supabase's default 6. Front-end forms
// surface this as a hint; the schema is the defence-in-depth check
// before any API call.
export const passwordSchema = z.string().min(8);

// Phone is informational on the marketplace — we don't call out.
// Regex tolerates international formats: leading +, digits, spaces,
// dashes and parentheses. Length 4-40 catches obviously broken input
// without rejecting locale-specific conventions.
export const phoneSchema = z.string().regex(/^[+\d\s\-()]{4,40}$/);

export const loginSchema = z.object({
  email: emailField,
  // Login does not require min 8 — the account already exists with
  // whatever password it was created with.
  password: z.string().min(1),
});

export const registerSchema = z.object({
  full_name: z.string().min(2).max(120),
  phone: phoneSchema,
  preferred_country: z.string().uuid(),
  preferred_city: z.string().uuid(),
  email: emailField,
  password: passwordSchema,
});

export const forgotSchema = z.object({
  email: emailField,
});

export const resetSchema = z
  .object({
    password: passwordSchema,
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, {
    path: ['confirm'],
    message: 'passwords_do_not_match',
  });

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type ForgotInput = z.infer<typeof forgotSchema>;
export type ResetInput = z.infer<typeof resetSchema>;
