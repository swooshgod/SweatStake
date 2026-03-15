/**
 * Podium — Dual payment system types and helpers.
 *
 * Supports Stripe (cards / Apple Pay) and USDC on Base.
 * Entry fees are held in escrow; winner receives 90% of the pot.
 */

export type PaymentMethod = "stripe" | "usdc";

export interface PaymentConfig {
  method: PaymentMethod;
  entryFee: number; // USD amount
  competitionId: string;
  userId: string;
  walletAddress?: string; // required for USDC
}

export interface PayoutConfig {
  competitionId: string;
  winnerId: string;
  totalPot: number; // USD or USDC amount
  method: PaymentMethod;
  winnerWalletAddress?: string; // for USDC
  winnerStripeAccountId?: string; // for Stripe Connect
}

export const SERVICE_FEE_PCT = 0.1; // 10%

export function calculatePayout(totalPot: number): {
  winnerAmount: number;
  fee: number;
} {
  const fee = totalPot * SERVICE_FEE_PCT;
  return { winnerAmount: totalPot - fee, fee };
}
