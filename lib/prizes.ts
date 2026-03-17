/**
 * Podium — Prize Credits System
 *
 * App Store compliance layer: users earn "Podium Credits" instead of
 * direct cash. Credits are redeemed for real payouts via Stripe, USDC,
 * or gift cards. This pattern keeps the app in the "skill competition"
 * category rather than "gambling/real money gaming."
 *
 * 100 Credits = $1.00 USD
 */

import { supabase } from './supabase';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const CREDITS_PER_DOLLAR = 100;
export const MIN_REDEMPTION_CREDITS = 500; // $5 minimum redemption

export type RedemptionMethod = 'stripe' | 'usdc' | 'gift_card';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CreditsLedgerEntry {
  id: string;
  user_id: string;
  amount: number;
  reason: string;
  competition_id?: string;
  created_at: string;
}

export interface RedemptionResult {
  success: boolean;
  error?: string;
  transactionId?: string;
}

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

/**
 * Format credits for display.
 * Example: formatCredits(1250) → "1,250 Credits (~$12.50)"
 */
export function formatCredits(credits: number): string {
  const dollars = (credits / CREDITS_PER_DOLLAR).toFixed(2);
  return `${credits.toLocaleString()} Credits (~$${dollars})`;
}

/**
 * Convert a competition prize pool to credits display string.
 * Example: competitionPrizeInCredits(5000) → "5,000 Credits ($50.00)"
 */
export function competitionPrizeInCredits(prizePoolCents: number): string {
  const credits = Math.floor((prizePoolCents / 100) * CREDITS_PER_DOLLAR);
  const dollars = (prizePoolCents / 100).toFixed(2);
  return `${credits.toLocaleString()} Credits ($${dollars})`;
}

/**
 * Convert cents to credits.
 */
export function centsToCredits(cents: number): number {
  return Math.floor((cents / 100) * CREDITS_PER_DOLLAR);
}

/**
 * Convert credits to cents.
 */
export function creditsToCents(credits: number): number {
  return Math.floor((credits / CREDITS_PER_DOLLAR) * 100);
}

// ---------------------------------------------------------------------------
// Credits balance
// ---------------------------------------------------------------------------

/**
 * Get the current credits balance for a user.
 */
export async function getCreditsBalance(userId: string): Promise<number> {
  const { data, error } = await supabase
    .from('profiles')
    .select('credits_balance')
    .eq('id', userId)
    .single();

  if (error || !data) {
    console.warn('[Credits] Failed to fetch balance:', error?.message);
    return 0;
  }

  return data.credits_balance ?? 0;
}

// ---------------------------------------------------------------------------
// Awarding credits
// ---------------------------------------------------------------------------

/**
 * Award credits to a user and record in the ledger.
 *
 * @param userId - The user receiving credits
 * @param amount - Number of credits to award
 * @param reason - Human-readable reason (e.g. "Won Step Race · March 2026")
 * @param competitionId - Optional competition ID for audit trail
 */
export async function awardCredits(
  userId: string,
  amount: number,
  reason: string,
  competitionId?: string
): Promise<boolean> {
  // Insert ledger entry
  const { error: ledgerError } = await supabase.from('credits_ledger').insert({
    user_id: userId,
    amount,
    reason,
    competition_id: competitionId ?? null,
  });

  if (ledgerError) {
    console.warn('[Credits] Ledger insert failed:', ledgerError.message);
    return false;
  }

  // Update profile balance
  const { error: balanceError } = await supabase.rpc('increment_credits', {
    p_user_id: userId,
    p_amount: amount,
  });

  if (balanceError) {
    console.warn('[Credits] Balance update failed:', balanceError.message);
    return false;
  }

  return true;
}

/**
 * Award competition winnings as credits.
 * Called by the payout-winner edge function result handler.
 */
export async function awardCompetitionWinnings(
  userId: string,
  prizePoolCents: number,
  competitionName: string,
  competitionId: string
): Promise<boolean> {
  const credits = centsToCredits(prizePoolCents);
  const reason = `Won "${competitionName}"`;
  return awardCredits(userId, credits, reason, competitionId);
}

// ---------------------------------------------------------------------------
// Redeeming credits
// ---------------------------------------------------------------------------

/**
 * Redeem credits for a real payout.
 * Calls the Supabase edge function `redeem-credits` which handles
 * Stripe transfer, USDC send, or gift card fulfillment.
 *
 * @param userId - The user redeeming
 * @param amountCredits - How many credits to redeem
 * @param method - Payment method for the redemption
 */
export async function redeemCredits(
  userId: string,
  amountCredits: number,
  method: RedemptionMethod
): Promise<RedemptionResult> {
  if (amountCredits < MIN_REDEMPTION_CREDITS) {
    return {
      success: false,
      error: `Minimum redemption is ${formatCredits(MIN_REDEMPTION_CREDITS)}.`,
    };
  }

  const currentBalance = await getCreditsBalance(userId);
  if (currentBalance < amountCredits) {
    return {
      success: false,
      error: `Insufficient credits. You have ${formatCredits(currentBalance)}.`,
    };
  }

  const { data, error } = await supabase.functions.invoke('redeem-credits', {
    body: {
      user_id: userId,
      amount_credits: amountCredits,
      method,
    },
  });

  if (error) {
    console.warn('[Credits] Redemption failed:', error.message);
    return { success: false, error: error.message };
  }

  return {
    success: true,
    transactionId: data?.transaction_id,
  };
}

// ---------------------------------------------------------------------------
// Prize display helpers (for UI)
// ---------------------------------------------------------------------------

/**
 * Get a user-facing summary of their credits.
 */
export function getCreditsDisplay(credits: number): {
  label: string;
  dollarValue: string;
  canRedeem: boolean;
} {
  return {
    label: `${credits.toLocaleString()} Credits`,
    dollarValue: `$${(credits / CREDITS_PER_DOLLAR).toFixed(2)}`,
    canRedeem: credits >= MIN_REDEMPTION_CREDITS,
  };
}
