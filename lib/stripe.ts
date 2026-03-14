/**
 * Stripe helpers for SweatStake.
 *
 * In production, payment intents and customer creation happen server-side
 * (Supabase Edge Functions). These helpers handle the client-side flow.
 */

const STRIPE_PUBLISHABLE_KEY = 'pk_test_placeholder';

export { STRIPE_PUBLISHABLE_KEY };

/**
 * Format cents to a display string.
 */
export function formatCents(cents: number): string {
  if (cents === 0) return 'Free';
  return `$${(cents / 100).toFixed(2)}`;
}

/**
 * Format prize pool with service fee deducted.
 */
export function formatPrizePool(totalCents: number, serviceFeePct: number): string {
  const net = totalCents * (1 - serviceFeePct / 100);
  return formatCents(Math.round(net));
}

/**
 * Calculate expected prize pool based on entry fee and participant count.
 */
export function calculatePrizePool(entryFeeCents: number, participantCount: number): number {
  return entryFeeCents * participantCount;
}
