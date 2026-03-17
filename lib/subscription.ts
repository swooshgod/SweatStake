/**
 * Podium Pro — Subscription System
 *
 * $9.99/month via Apple In-App Purchase.
 * Pro members pay 0% service fee (vs 10% for free users).
 * Handled via RevenueCat for subscription management.
 *
 * Pro benefits:
 * - Zero service fee on winnings
 * - Pro badge on leaderboard
 * - Access to Pro-only competitions (higher stakes)
 * - Priority matchmaking
 */

import { supabase } from './supabase';

// ---------------------------------------------------------------------------
// Product IDs (must match App Store Connect)
// ---------------------------------------------------------------------------

export const PRO_PRODUCT_ID_MONTHLY  = 'com.podiumapp.pro.monthly';
export const PRO_PRODUCT_ID_YEARLY   = 'com.podiumapp.pro.yearly';

export const PRO_PRICE_MONTHLY = 9.99;
export const PRO_PRICE_YEARLY  = 79.99; // ~$6.67/month, saves ~33%

export const PRO_SERVICE_FEE_PCT = 0;    // 0% for Pro
export const FREE_SERVICE_FEE_PCT = 0.10; // 10% for free users

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ProStatus {
  isPro: boolean;
  expiresAt: string | null;
  daysRemaining: number | null;
}

export interface ProSavingsEstimate {
  monthlyWinnings: number;
  feeSaved: number;
  subscriptionCost: number;
  netSavings: number;
  worthIt: boolean;
}

// ---------------------------------------------------------------------------
// Check Pro status
// ---------------------------------------------------------------------------

export async function getProStatus(userId: string): Promise<ProStatus> {
  const { data, error } = await supabase
    .from('profiles')
    .select('is_pro, pro_expires_at')
    .eq('id', userId)
    .single();

  if (error || !data) return { isPro: false, expiresAt: null, daysRemaining: null };

  const isPro = data.is_pro ?? false;
  const expiresAt = data.pro_expires_at ?? null;

  let daysRemaining: number | null = null;
  if (isPro && expiresAt) {
    const diff = new Date(expiresAt).getTime() - Date.now();
    daysRemaining = Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  }

  return { isPro, expiresAt, daysRemaining };
}

// ---------------------------------------------------------------------------
// Calculate service fee based on Pro status
// ---------------------------------------------------------------------------

export function getServiceFee(totalPotCents: number, isPro: boolean): {
  feePct: number;
  feeCents: number;
  winnerAmountCents: number;
} {
  const feePct = isPro ? PRO_SERVICE_FEE_PCT : FREE_SERVICE_FEE_PCT;
  const feeCents = Math.floor(totalPotCents * feePct);
  const winnerAmountCents = totalPotCents - feeCents;
  return { feePct, feeCents, winnerAmountCents };
}

// ---------------------------------------------------------------------------
// Savings estimator (for upsell screen)
// ---------------------------------------------------------------------------

export function estimateProSavings(monthlyWinningsCents: number): ProSavingsEstimate {
  const monthlyWinnings = monthlyWinningsCents / 100;
  const feeSaved = monthlyWinnings * FREE_SERVICE_FEE_PCT;
  const subscriptionCost = PRO_PRICE_MONTHLY;
  const netSavings = feeSaved - subscriptionCost;
  const worthIt = feeSaved > subscriptionCost;

  return { monthlyWinnings, feeSaved, subscriptionCost, netSavings, worthIt };
}

// ---------------------------------------------------------------------------
// Pro badge display
// ---------------------------------------------------------------------------

export interface ProBadge {
  label: string;
  color: string;
  bgColor: string;
  emoji: string;
}

export function getProBadge(): ProBadge {
  return {
    label: 'PRO',
    color: '#F5C518',
    bgColor: 'rgba(245, 197, 24, 0.15)',
    emoji: '⭐',
  };
}

// ---------------------------------------------------------------------------
// Activate/sync Pro status from RevenueCat webhook
// (Called by Supabase edge function, not client)
// ---------------------------------------------------------------------------

export async function syncProStatus(
  userId: string,
  isPro: boolean,
  expiresAt: string | null,
  productId: string,
  eventType: 'subscribed' | 'renewed' | 'cancelled' | 'expired' | 'trial_started'
): Promise<void> {
  await supabase
    .from('profiles')
    .update({
      is_pro: isPro,
      pro_expires_at: expiresAt,
    })
    .eq('id', userId);

  await supabase
    .from('subscription_events')
    .insert({
      user_id: userId,
      event_type: eventType,
      product_id: productId,
      expires_at: expiresAt,
    });
}
