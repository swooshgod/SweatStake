/**
 * Stripe helpers for Podium.
 *
 * Client-side: publishable key, formatting, PaymentIntent confirmation.
 * Server-side (Supabase Edge Functions): PaymentIntent creation,
 * Connect account onboarding, and winner payouts.
 */

import { SERVICE_FEE_PCT } from "./payments";

export const STRIPE_PUBLISHABLE_KEY =
  process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY ??
  "pk_test_51SitGnPjIh63faVKhYyhzhWS7DUqC6jYHSzzELWWfRDhX5L3W3C7nSGsQ6pSg4Nu0N0MzLvKs1JkRJaMfM7FeP5200XuyT6xmt";

// ── Formatting ──────────────────────────────────────────────────────────────

export function formatCents(cents: number): string {
  if (cents === 0) return "Free";
  return `$${(cents / 100).toFixed(2)}`;
}

/** Format cents as a dollar amount — always shows dollar value, never "Free". */
export function formatDollars(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export function formatPrizePool(
  totalCents: number,
  serviceFeePct: number
): string {
  const net = totalCents * (1 - serviceFeePct / 100);
  return formatCents(Math.round(net));
}

export function calculatePrizePool(
  entryFeeCents: number,
  participantCount: number
): number {
  return entryFeeCents * participantCount;
}

// ── Server-side helpers (call from Supabase Edge Functions) ─────────────────
//
// The functions below are documented here for reference but MUST run on the
// server where the Stripe secret key is available.
//
// createEntryPaymentIntent(amount, competitionId, userId)
//   → creates a PaymentIntent with metadata { competitionId, userId }
//   → returns { clientSecret, paymentIntentId }
//
// createConnectAccount(email)
//   → creates a Stripe Connect Express account for winner payouts
//   → returns { accountId, onboardingUrl }
//
// payoutWinner(stripeAccountId, amount, competitionId)
//   → transfers (amount * (1 - SERVICE_FEE_PCT)) to the winner's Connect account
//   → Podium keeps 10% as platform fee
//   → returns { transferId }

/**
 * Shape returned by the server-side createEntryPaymentIntent edge function.
 */
export interface EntryPaymentResult {
  clientSecret: string;
  paymentIntentId: string;
}

/**
 * Shape returned by the server-side createConnectAccount edge function.
 */
export interface ConnectAccountResult {
  accountId: string;
  onboardingUrl: string;
}

/**
 * Shape returned by the server-side payoutWinner edge function.
 */
export interface PayoutResult {
  transferId: string;
  winnerAmount: number;
  fee: number;
}
