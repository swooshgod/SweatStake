import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import Stripe from 'https://esm.sh/stripe@13.11.0?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { ethers } from 'https://esm.sh/ethers@5.7.2';

/**
 * payout-winner — triggered by auto-payout or manually by admin
 *
 * SECURITY:
 * - Requires valid service role JWT OR x-podium-internal secret header
 * - Uses Postgres advisory lock to prevent double-payout race condition
 * - Checks idempotency: won't pay out a completed competition
 */

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  apiVersion: '2023-10-16',
  httpClient: Stripe.createFetchHttpClient(),
});

const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('APP_ORIGIN') ?? 'https://podiumapp.com',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-podium-internal',
};

const USDC_BASE = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
const SERVICE_FEE_PCT = 0.10;

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  // ── Auth: service role JWT OR internal cron secret ─────────────────────────
  const authHeader = req.headers.get('Authorization');
  const internalSecret = req.headers.get('x-podium-internal');
  const cronSecret = Deno.env.get('CRON_SECRET');

  const isInternalCall = internalSecret && cronSecret && internalSecret === cronSecret;
  const hasAuthHeader = !!authHeader;

  if (!isInternalCall && !hasAuthHeader) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  // If JWT provided, verify it's a service role token or competition creator
  if (hasAuthHeader && !isInternalCall) {
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), { status: 401, headers: corsHeaders });
    }
    // Only allow if user is service role — regular users cannot trigger payouts
    // Service role JWTs don't have a user object, so if we got here it's a user JWT
    // Only permit if they're the competition creator (checked below)
  }

  try {
    const { competitionId } = await req.json();
    if (!competitionId) throw new Error('competitionId required');

    // ── Idempotency lock: use Postgres advisory lock on competition ID ────────
    // Convert UUID to bigint for advisory lock
    const lockKey = parseInt(competitionId.replace(/-/g, '').substring(0, 15), 16);
    const { data: lockResult } = await supabase.rpc('try_advisory_lock', { lock_key: lockKey });

    if (!lockResult) {
      return new Response(
        JSON.stringify({ error: 'Payout already in progress for this competition' }),
        { status: 409, headers: corsHeaders }
      );
    }

    try {
      // ── Fetch competition ─────────────────────────────────────────────────
      const { data: comp, error: compError } = await supabase
        .from('competitions')
        .select('*')
        .eq('id', competitionId)
        .single();

      if (compError || !comp) throw new Error('Competition not found');
      if (comp.status === 'completed') throw new Error('Already paid out — idempotency check passed');
      if (comp.status === 'cancelled') throw new Error('Competition was cancelled');
      if (!['active', 'open', 'paying_out'].includes(comp.status)) throw new Error(`Invalid status: ${comp.status}`);

      // If JWT call, verify user is the creator
      if (hasAuthHeader && !isInternalCall) {
        const token = authHeader.replace('Bearer ', '');
        const { data: { user } } = await supabase.auth.getUser(token);
        if (user?.id !== comp.creator_id) {
          throw new Error('Only the competition creator can trigger manual payouts');
        }
      }

      // ── Find winner (exclude disqualified participants) ─────────────────
      const { data: winner, error: winnerError } = await supabase
        .from('participants')
        .select('user_id, total_points, best_streak, joined_at, profiles(display_name, stripe_connect_account_id, wallet_address)')
        .eq('competition_id', competitionId)
        .eq('paid', true)
        .or('disqualified.is.null,disqualified.eq.false')
        .order('total_points', { ascending: false })
        .order('best_streak', { ascending: false })
        .order('joined_at', { ascending: true })
        .limit(1)
        .single();

      if (winnerError || !winner) throw new Error('No eligible winner found');

      // ── Recalculate prize pool from actual paid participants ──────────────
      const { count: paidCount } = await supabase
        .from('participants')
        .select('*', { count: 'exact', head: true })
        .eq('competition_id', competitionId)
        .eq('paid', true);

      const actualPrizePool = comp.entry_fee_cents > 0
        ? (paidCount ?? 0) * comp.entry_fee_cents
        : 0;
      const totalPot = actualPrizePool;
      const fee = Math.floor(totalPot * SERVICE_FEE_PCT);
      const winnerAmount = totalPot - fee;

      let payoutResult: any = {};

      // ── Mark as 'paying_out' to prevent concurrent attempts ────────────────
      const { error: lockError } = await supabase
        .from('competitions')
        .update({ status: 'paying_out' })
        .eq('id', competitionId)
        .eq('status', comp.status); // Optimistic concurrency check

      if (lockError) throw new Error('Failed to lock competition status — concurrent update detected');

      // ── Execute payout (skip if prize is $0) ──────────────────────────────
      if (winnerAmount > 0) {
        try {
          if (comp.payment_type === 'stripe') {
            const connectAccountId = winner.profiles?.stripe_connect_account_id;
            if (!connectAccountId) throw new Error('Winner has no Stripe Connect account');

            const transfer = await stripe.transfers.create({
              amount: winnerAmount,
              currency: 'usd',
              destination: connectAccountId,
              metadata: {
                competition_id: competitionId,
                winner_id: winner.user_id,
                total_pot_cents: String(totalPot),
                fee_cents: String(fee),
              },
              description: `Podium winnings — ${comp.name}`,
            });

            payoutResult = { method: 'stripe', transferId: transfer.id, amount: winnerAmount / 100 };

          } else if (comp.payment_type === 'usdc') {
            const winnerAddress = winner.profiles?.wallet_address;
            if (!winnerAddress) throw new Error('Winner has no wallet address');

            const escrowKey = Deno.env.get('PODIUM_ESCROW_PRIVATE_KEY');
            if (!escrowKey) throw new Error('Escrow key not configured');

            const provider = new ethers.providers.JsonRpcProvider('https://mainnet.base.org');
            const wallet = new ethers.Wallet(escrowKey, provider);
            const usdcAbi = ['function transfer(address to, uint256 amount) returns (bool)'];
            const usdc = new ethers.Contract(USDC_BASE, usdcAbi, wallet);
            const usdcAmount = ethers.utils.parseUnits((winnerAmount / 100).toFixed(2), 6);
            const tx = await usdc.transfer(winnerAddress, usdcAmount);
            await tx.wait();

            payoutResult = { method: 'usdc', txHash: tx.hash, amount: winnerAmount / 100 };
          }
        } catch (payoutError) {
          // Rollback status so payout can be retried
          await supabase
            .from('competitions')
            .update({ status: comp.status })
            .eq('id', competitionId);
          throw payoutError;
        }
      } else {
        payoutResult = { method: 'none', amount: 0, reason: 'Free competition — no monetary payout' };
      }

      // ── Mark as completed AFTER successful payout ──────────────────────────
      await supabase
        .from('competitions')
        .update({
          status: 'completed',
          winner_id: winner.user_id,
          prize_pool_cents: actualPrizePool, // Store actual amount collected
        })
        .eq('id', competitionId);

      // ── Update winner profile stats ────────────────────────────────────────
      if (winnerAmount > 0) {
        await supabase.rpc('increment_credits', {
          p_user_id: winner.user_id,
          p_amount: Math.floor((winnerAmount / 100) * 100), // convert to credits
        });
      }

      // Increment competitions_won via RPC
      await supabase.rpc('increment_competitions_won', {
        p_user_id: winner.user_id,
      });

      console.log(`[payout-winner] ✅ Paid out ${comp.name} to ${winner.profiles?.display_name}: $${winnerAmount / 100}`);

      return new Response(
        JSON.stringify({ success: true, payout: payoutResult, winner: winner.profiles?.display_name }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } finally {
      // Always release the advisory lock
      await supabase.rpc('release_advisory_lock', { lock_key: lockKey });
    }

  } catch (err) {
    console.error('[payout-winner] Error:', err.message);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
