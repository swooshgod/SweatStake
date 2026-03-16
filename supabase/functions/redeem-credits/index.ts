/**
 * Podium — redeem-credits Edge Function
 * Deploy: supabase functions deploy redeem-credits
 *
 * Handles credit redemption requests:
 * - Validates balance
 * - Deducts credits atomically
 * - Triggers Stripe transfer or USDC send
 * - Records redemption in credits_redemptions table
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Stripe from 'https://esm.sh/stripe@14?target=deno';

const CREDITS_PER_DOLLAR = 100;
const MIN_REDEMPTION_CREDITS = 500; // $5 minimum

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  apiVersion: '2023-10-16',
  httpClient: Stripe.createFetchHttpClient(),
});

serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  try {
    const { user_id, amount_credits, method } = await req.json();

    // Validate input
    if (!user_id || !amount_credits || !method) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (amount_credits < MIN_REDEMPTION_CREDITS) {
      return Response.json(
        { error: `Minimum redemption is ${MIN_REDEMPTION_CREDITS} credits ($${MIN_REDEMPTION_CREDITS / CREDITS_PER_DOLLAR})` },
        { status: 400 }
      );
    }

    const amountCents = Math.floor((amount_credits / CREDITS_PER_DOLLAR) * 100);

    // Get user profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, credits_balance, stripe_customer_id, wallet_address')
      .eq('id', user_id)
      .single();

    if (profileError || !profile) {
      return Response.json({ error: 'User not found' }, { status: 404 });
    }

    if (profile.credits_balance < amount_credits) {
      return Response.json(
        { error: `Insufficient credits. Balance: ${profile.credits_balance}` },
        { status: 400 }
      );
    }

    // Create redemption record
    const { data: redemption, error: redemptionError } = await supabase
      .from('credits_redemptions')
      .insert({
        user_id,
        amount_credits,
        amount_cents: amountCents,
        method,
        status: 'processing',
      })
      .select()
      .single();

    if (redemptionError || !redemption) {
      return Response.json({ error: 'Failed to create redemption record' }, { status: 500 });
    }

    // Deduct credits atomically
    const { error: deductError } = await supabase.rpc('deduct_credits', {
      p_user_id: user_id,
      p_amount: amount_credits,
    });

    if (deductError) {
      // Mark redemption as failed
      await supabase
        .from('credits_redemptions')
        .update({ status: 'failed', error_message: deductError.message })
        .eq('id', redemption.id);

      return Response.json({ error: deductError.message }, { status: 400 });
    }

    // Record deduction in ledger
    await supabase.from('credits_ledger').insert({
      user_id,
      amount: -amount_credits,
      reason: `Redeemed ${amount_credits} credits via ${method}`,
    });

    let transactionId = '';

    // Process payout
    if (method === 'stripe') {
      if (!profile.stripe_customer_id) {
        throw new Error('No Stripe account connected. Please set up payouts in your profile.');
      }

      const transfer = await stripe.transfers.create({
        amount: amountCents,
        currency: 'usd',
        destination: profile.stripe_customer_id,
        metadata: {
          redemption_id: redemption.id,
          user_id,
          credits_redeemed: String(amount_credits),
        },
      });

      transactionId = transfer.id;

    } else if (method === 'usdc') {
      if (!profile.wallet_address) {
        throw new Error('No wallet address on file. Please add a wallet in your profile.');
      }

      // USDC payout handled by separate USDC edge function
      const { data: usdcResult, error: usdcError } = await supabase.functions.invoke('send-usdc', {
        body: {
          to_address: profile.wallet_address,
          amount_usd: amountCents / 100,
          redemption_id: redemption.id,
        },
      });

      if (usdcError || !usdcResult?.tx_hash) {
        throw new Error(usdcError?.message ?? 'USDC transfer failed');
      }

      transactionId = usdcResult.tx_hash;

    } else if (method === 'gift_card') {
      // Gift card fulfillment — integrate with Tango or similar
      // For now, flag for manual fulfillment
      transactionId = `gc_manual_${Date.now()}`;
    }

    // Mark redemption complete
    await supabase
      .from('credits_redemptions')
      .update({
        status: 'completed',
        transaction_id: transactionId,
        completed_at: new Date().toISOString(),
      })
      .eq('id', redemption.id);

    return Response.json({
      success: true,
      transaction_id: transactionId,
      amount_credits,
      amount_usd: amountCents / 100,
    });

  } catch (error) {
    console.error('[redeem-credits] Error:', error);
    return Response.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
});
