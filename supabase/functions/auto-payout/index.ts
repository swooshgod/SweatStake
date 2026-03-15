import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

/**
 * auto-payout — runs daily via Supabase cron
 * 1. Finds competitions whose end_date has passed and status = 'active'
 * 2. Finds winner (highest total_points, tiebreak: best_streak, then earliest join date)
 * 3. Calls payout-winner for each
 * 4. Cancels/refunds underfilled competitions (< min_participants)
 */

const MIN_PARTICIPANTS = 3;

serve(async (req) => {
  // Allow manual trigger with auth OR scheduled cron (no auth)
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  const today = new Date().toISOString().split('T')[0];
  const results: any[] = [];

  // ── 1. Find competitions to payout ──────────────────────────────────────────
  const { data: toPayOut } = await supabase
    .from('competitions')
    .select('*')
    .eq('status', 'active')
    .lte('end_date', today);

  for (const comp of toPayOut || []) {
    // Count paid participants
    const { count: paidCount } = await supabase
      .from('participants')
      .select('*', { count: 'exact', head: true })
      .eq('competition_id', comp.id)
      .eq('paid', true);

    // Not enough participants — refund and cancel
    if ((paidCount || 0) < MIN_PARTICIPANTS) {
      await refundAndCancel(supabase, comp);
      results.push({ id: comp.id, name: comp.name, action: 'cancelled_refunded', participants: paidCount });
      continue;
    }

    // Find winner: most points → best streak → earliest join
    const { data: winner } = await supabase
      .from('participants')
      .select('user_id, total_points, best_streak, joined_at, profiles(display_name, stripe_connect_account_id, wallet_address)')
      .eq('competition_id', comp.id)
      .eq('paid', true)
      .order('total_points', { ascending: false })
      .order('best_streak', { ascending: false })
      .order('joined_at', { ascending: true })
      .limit(1)
      .single();

    if (!winner) continue;

    // Trigger payout
    try {
      const payoutResp = await fetch(
        `${Deno.env.get('SUPABASE_URL')}/functions/v1/payout-winner`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
          },
          body: JSON.stringify({ competitionId: comp.id }),
        }
      );
      const payoutResult = await payoutResp.json();
      results.push({ id: comp.id, name: comp.name, action: 'paid_out', winner: winner.profiles?.display_name, result: payoutResult });
    } catch (e) {
      results.push({ id: comp.id, name: comp.name, action: 'payout_failed', error: e.message });
    }
  }

  // ── 2. Activate competitions that have hit min participants ──────────────────
  const { data: toActivate } = await supabase
    .from('competitions')
    .select('id, name')
    .eq('status', 'open')
    .gte('start_date', today);

  for (const comp of toActivate || []) {
    const { count } = await supabase
      .from('participants')
      .select('*', { count: 'exact', head: true })
      .eq('competition_id', comp.id)
      .eq('paid', true);

    if ((count || 0) >= MIN_PARTICIPANTS) {
      await supabase
        .from('competitions')
        .update({ status: 'active' })
        .eq('id', comp.id)
        .eq('status', 'open');
      results.push({ id: comp.id, name: comp.name, action: 'activated', participants: count });
    }
  }

  console.log('Auto-payout results:', JSON.stringify(results));
  return new Response(JSON.stringify({ ok: true, processed: results.length, results }), {
    headers: { 'Content-Type': 'application/json' },
  });
});

async function refundAndCancel(supabase: any, comp: any) {
  // Mark cancelled
  await supabase
    .from('competitions')
    .update({ status: 'cancelled' })
    .eq('id', comp.id);

  if (comp.entry_fee_cents === 0 || comp.payment_type === 'usdc') return;

  // Stripe refunds — refund each participant's PaymentIntent
  const { data: participants } = await supabase
    .from('participants')
    .select('user_id, payment_intent_id')
    .eq('competition_id', comp.id)
    .eq('paid', true);

  const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
  for (const p of participants || []) {
    if (!p.payment_intent_id) continue;
    try {
      await fetch(`https://api.stripe.com/v1/refunds`, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${btoa(stripeKey + ':')}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: `payment_intent=${p.payment_intent_id}`,
      });
    } catch (e) {
      console.error(`Refund failed for ${p.payment_intent_id}:`, e);
    }
  }
}
