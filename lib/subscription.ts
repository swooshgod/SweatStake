/**
 * Podium Pro — Subscription System
 * Powered by RevenueCat (react-native-purchases)
 *
 * $9.99/month or $79.99/year via Apple IAP.
 * Pro members pay 0% service fee (vs 10% for free users).
 */

import { Platform } from 'react-native';
import { supabase } from './supabase';

// ---------------------------------------------------------------------------
// Product IDs (must match App Store Connect exactly)
// ---------------------------------------------------------------------------

export const PRO_PRODUCT_ID_MONTHLY = 'com.podiumapp.pro.monthly';
export const PRO_PRODUCT_ID_YEARLY  = 'com.podiumapp.pro.yearly';
export const REVENUECAT_API_KEY_IOS = 'test_kaTdWTcQaylEoZrOfqPdzrNPJag';

export const PRO_PRICE_MONTHLY = 9.99;
export const PRO_PRICE_YEARLY  = 79.99;

export const PRO_SERVICE_FEE_PCT  = 0;
export const FREE_SERVICE_FEE_PCT = 0.10;

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
// Initialize RevenueCat (call once at app startup)
// ---------------------------------------------------------------------------

export async function initRevenueCat(userId?: string): Promise<void> {
  if (Platform.OS !== 'ios') return;

  try {
    const Purchases = require('react-native-purchases').default;
    await Purchases.configure({ apiKey: REVENUECAT_API_KEY_IOS });

    if (userId) {
      await Purchases.logIn(userId);
    }
  } catch (error) {
    console.warn('[RevenueCat] Init failed:', error);
  }
}

// ---------------------------------------------------------------------------
// Purchase subscription
// ---------------------------------------------------------------------------

export async function purchaseProMonthly(): Promise<{ success: boolean; error?: string }> {
  if (Platform.OS !== 'ios') {
    return { success: false, error: 'iOS only' };
  }

  try {
    const Purchases = require('react-native-purchases').default;

    const offerings = await Purchases.getOfferings();
    const monthly = offerings.current?.availablePackages?.find(
      (p: any) => p.product.identifier === PRO_PRODUCT_ID_MONTHLY
    );

    if (!monthly) {
      return { success: false, error: 'Product not found. Please try again.' };
    }

    const { customerInfo } = await Purchases.purchasePackage(monthly);
    const isPro = customerInfo.entitlements.active['pro'] !== undefined;

    return { success: isPro };
  } catch (error: any) {
    if (error.userCancelled) return { success: false, error: 'cancelled' };
    return { success: false, error: error.message ?? 'Purchase failed.' };
  }
}

export async function purchaseProYearly(): Promise<{ success: boolean; error?: string }> {
  if (Platform.OS !== 'ios') {
    return { success: false, error: 'iOS only' };
  }

  try {
    const Purchases = require('react-native-purchases').default;

    const offerings = await Purchases.getOfferings();
    const yearly = offerings.current?.availablePackages?.find(
      (p: any) => p.product.identifier === PRO_PRODUCT_ID_YEARLY
    );

    if (!yearly) {
      return { success: false, error: 'Product not found. Please try again.' };
    }

    const { customerInfo } = await Purchases.purchasePackage(yearly);
    const isPro = customerInfo.entitlements.active['pro'] !== undefined;

    return { success: isPro };
  } catch (error: any) {
    if (error.userCancelled) return { success: false, error: 'cancelled' };
    return { success: false, error: error.message ?? 'Purchase failed.' };
  }
}

export async function restorePurchases(): Promise<{ isPro: boolean; error?: string }> {
  try {
    const Purchases = require('react-native-purchases').default;
    const { customerInfo } = await Purchases.restorePurchases();
    const isPro = customerInfo.entitlements.active['pro'] !== undefined;
    return { isPro };
  } catch (error: any) {
    return { isPro: false, error: error.message };
  }
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
    if (daysRemaining === 0) return { isPro: false, expiresAt, daysRemaining: 0 };
  }

  return { isPro, expiresAt, daysRemaining };
}

// ---------------------------------------------------------------------------
// Fee calculation
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
// Savings calculator
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
// Pro badge
// ---------------------------------------------------------------------------

export interface ProBadge { label: string; color: string; bgColor: string; emoji: string; }

export function getProBadge(): ProBadge {
  return { label: 'PRO', color: '#F5C518', bgColor: 'rgba(245,197,24,0.15)', emoji: '⭐' };
}

// ---------------------------------------------------------------------------
// Sync from RevenueCat webhook (edge function, not client)
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
    .update({ is_pro: isPro, pro_expires_at: expiresAt })
    .eq('id', userId);

  await supabase
    .from('subscription_events')
    .insert({ user_id: userId, event_type: eventType, product_id: productId, expires_at: expiresAt });
}
