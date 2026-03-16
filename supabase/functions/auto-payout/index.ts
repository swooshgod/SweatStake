import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

/**
 * auto-payout — runs daily via Supabase cron
 * 
 * SECURITY: Requires x-podium-cron-secret header.
 * Set CRON_SECRET in Supabase edge function secrets.
 * Pass the same secret in your cron job header.
 */

const MIN_PARTICIPANTS = 3;

serve(async (req) => {
  // ── Auth: require cron secret header ──────────────────────────────────────
  const cronSecret = req.headers.get('x-podium-cron-secret');
  const expectedSecret = Deno.env.get('CRON_SECRET');

  if (!expectedSecret) {
    console.error('[auto-payout] CRON_SECRET env var not set!');
    return new Response('Server misconfiguration', { status: 500 });
  }

  if (!cronSecret || cronSecret !== expectedSecret) {
    console.warn('[auto-payout] Unauthorized attempt — bad or missing cron secret');
    return new Response('Unauthorized', { status: 401 });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  const today = new Date().toISOString().split('T')[0];
  const results: any[] = [];

  // ── 1. Find completed competitions to pay out ──────────────────────────────
  const { data: toPayOut } = await supabase
    .from('competitions')
    .select('*')
    .eq('status', 'active')
    .lte('end_date', today);

  for (const comp of toPayOut || []) {
    const { count: paidCount } = await supabase
      .from('participants')
      .select('*', { count: 'exact', head: true })
      .eq('competition_id', comp.id)
      .eq('paid', true);

    if ((paidCount || 0) < MIN_PARTICIPANTS) {
      await refundAndCancel(supabase, comp);
      results.push({ id: comp.id, name: comp.name, action: 'cancelled_refunded', participants: paidCount });
      continue;
    }

    try {
      const payoutResp = await fetch(
        `${Deno.env.get('SUPABASE_URL')}/functions/v1/payout-winner`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            // Pass service role key — payout-winner verifies this
            'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
            'x-podium-internal': Deno.env.get('CRON_SECRET')!,
          },
          body: JSON.stringify({ competitionId: comp.id }),
        }
      );
      const payoutResult = await payoutResp.json();
      results.push({ id: comp.id, name: comp.name, action: 'paid_out', result: payoutResult });
    } catch (e) {
      console.error(`[auto-payout] Payout failed for ${comp.id}:`, e);
      results.push({ id: comp.id, name: comp.name, action: 'payout_failed', error: e.message });
    }
  }

  // ── 2. Activate competitions that hit min participants ─────────────────────
  const { data: toActivate } = await supabase
    .from('competitions')
    .select('id, name')
    .eq('status', 'open')
    .lte('start_date', today);

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
        .eq('status', 'open'); // Only if still open
      results.push({ id: comp.id, name: comp.name, action: 'activated', participants: count });
    }
  }

  console.log('[auto-payout] Results:', JSON.stringify(results));
  return new Response(JSON.stringify({ ok: true, processed: results.length, results }), {
    headers: { 'Content-Type': 'application/json' },
  });
});

async function refundAndCancel(supabase: any, comp: any) {
  await supabase
    .from('competitions')
    .update({ status: 'cancelled' })
    .eq('id', comp.id);

  if (comp.entry_fee_cents === 0 || comp.payment_type === 'usdc') return;

  const { data: participants } = await supabase
    .from('participants')
    .select('user_id, payment_intent_id')
    .eq('competition_id', comp.id)
    .eq('paid', true);

  const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
  for (const p of participants || []) {
    if (!p.payment_intent_id) continue;
    try {
      await fetch('https://api.stripe.com/v1/refunds', {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${btoa(stripeKey + ':')}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: `payment_intent=${p.payment_intent_id}`,
      });
      console.log(`[refund] Refunded ${p.payment_intent_id}`);
    } catch (e) {
      console.error(`[refund] Failed for ${p.payment_intent_id}:`, e);
    }
  }
}
