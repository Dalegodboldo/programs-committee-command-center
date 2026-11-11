import type { Row } from './types';

// A goal counts as met when it's ticked, or when its count reaches the target.
export function goalMet(g: Row) {
  if (g.done) return true;
  return g.target_value != null && Number(g.current_value ?? 0) >= Number(g.target_value);
}

// Reads one query-string value on the client (avoids a Suspense boundary for useSearchParams).
export function queryParam(name: string): string | null {
  if (typeof window === 'undefined') return null;
  return new URLSearchParams(window.location.search).get(name);
}
