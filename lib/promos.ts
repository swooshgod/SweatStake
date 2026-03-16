/**
 * Podium — Promo Code System
 *
 * Supports:
 * - Fixed discount codes (e.g. PODIUM10 = $10 off entry fee)
 * - Free entry codes (100% off)
 * - Limited use codes (e.g. first 50 users only)
 * - Per-user single-use enforcement
 */

import { supabase } from './supabase';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PromoCode {
  id: string;
  code: string;
  description: string;
  discount_cents: number;       // e.g. 1000 = $10 off
  discount_pct: number | null;  // e.g. 100 = 100% off (free entry)
  max_uses: number | null;      // null = unlimited
  uses_count: number;
  min_entry_cents: number;      // minimum entry fee required to use
  expires_at: string | null;
  active: boolean;
}

export interface PromoValidationResult {
  valid: boolean;
  promo?: PromoCode;
  discountCents: number;
  finalEntryCents: number;
  error?: string;
  message?: string;
}

// ---------------------------------------------------------------------------
// Validate a promo code
// ---------------------------------------------------------------------------

export async function validatePromoCode(
  code: string,
  userId: string,
  entryCents: number
): Promise<PromoValidationResult> {
  const normalised = code.trim().toUpperCase();

  // Fetch the promo
  const { data: promo, error } = await supabase
    .from('promo_codes')
    .select('*')
    .eq('code', normalised)
    .eq('active', true)
    .single();

  if (error || !promo) {
    return { valid: false, discountCents: 0, finalEntryCents: entryCents, error: 'Invalid promo code.' };
  }

  // Check expiry
  if (promo.expires_at && new Date(promo.expires_at) < new Date()) {
    return { valid: false, discountCents: 0, finalEntryCents: entryCents, error: 'This promo code has expired.' };
  }

  // Check max uses
  if (promo.max_uses !== null && promo.uses_count >= promo.max_uses) {
    return { valid: false, discountCents: 0, finalEntryCents: entryCents, error: 'This promo code has been fully claimed.' };
  }

  // Check minimum entry fee
  if (entryCents < promo.min_entry_cents) {
    return {
      valid: false,
      discountCents: 0,
      finalEntryCents: entryCents,
      error: `This code requires a minimum $${(promo.min_entry_cents / 100).toFixed(0)} entry fee.`,
    };
  }

  // Check if user already used this code
  const { data: existing } = await supabase
    .from('promo_redemptions')
    .select('id')
    .eq('user_id', userId)
    .eq('code', normalised)
    .maybeSingle();

  if (existing) {
    return { valid: false, discountCents: 0, finalEntryCents: entryCents, error: 'You have already used this promo code.' };
  }

  // Calculate discount
  let discountCents = 0;
  if (promo.discount_pct !== null) {
    discountCents = Math.floor(entryCents * (promo.discount_pct / 100));
  } else {
    discountCents = Math.min(promo.discount_cents, entryCents);
  }

  const finalEntryCents = Math.max(0, entryCents - discountCents);

  return {
    valid: true,
    promo,
    discountCents,
    finalEntryCents,
    message: discountCents >= entryCents
      ? '🎉 Free entry applied!'
      : `✅ $${(discountCents / 100).toFixed(0)} off applied!`,
  };
}

// ---------------------------------------------------------------------------
// Record a promo redemption
// ---------------------------------------------------------------------------

export async function recordPromoRedemption(
  code: string,
  userId: string,
  competitionId: string,
  discountCents: number
): Promise<boolean> {
  const normalised = code.trim().toUpperCase();

  // Insert redemption record
  const { error: redemptionError } = await supabase
    .from('promo_redemptions')
    .insert({
      user_id: userId,
      code: normalised,
      competition_id: competitionId,
      discount_cents: discountCents,
    });

  if (redemptionError) {
    console.warn('[Promo] Redemption record failed:', redemptionError.message);
    return false;
  }

  // Increment uses count
  const { error: incrementError } = await supabase.rpc('increment_promo_uses', {
    p_code: normalised,
  });

  if (incrementError) {
    console.warn('[Promo] Uses increment failed:', incrementError.message);
  }

  return true;
}

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

export function formatDiscount(discountCents: number, entryCents: number): string {
  if (discountCents >= entryCents) return 'FREE ENTRY';
  return `-$${(discountCents / 100).toFixed(0)}`;
}
