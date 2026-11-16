/**
 * Demo mode (server-side only).
 *
 * The demo account is a dedicated user with NO password: it can only be
 * entered through the "demo" NextAuth provider, which exists only when
 * NEXT_PUBLIC_DEMO_MODE="true". Demo sessions are sandboxed to projects the
 * demo user owns (the seeded demo project) and cannot create projects or
 * administer members. See server/trpc.ts.
 */
export const DEMO_EMAIL = (process.env.DEMO_USER_EMAIL ?? "demo@agileboard.dev").toLowerCase();

export function isDemoEmail(email?: string | null): boolean {
  return !!email && email.trim().toLowerCase() === DEMO_EMAIL;
}

export function isDemoModeEnabled(): boolean {
  return process.env.NEXT_PUBLIC_DEMO_MODE === "true";
}
