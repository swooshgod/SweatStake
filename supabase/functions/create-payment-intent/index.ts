import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import Stripe from 'https://esm.sh/stripe@13.11.0?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  apiVersion: '2023-10-16',
  httpClient: Stripe.createFetchHttpClient(),
});

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('No auth header');

    const { data: { user } } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
    if (!user) throw new Error('Unauthorized');

    const { competitionId, promoCode } = await req.json();

    // Get competition details
    const { data: comp, error } = await supabase
      .from('competitions')
      .select('id, name, entry_fee_cents, status')
      .eq('id', competitionId)
      .single();

    if (error || !comp) throw new Error('Competition not found');
    if (comp.status !== 'open') throw new Error('Competition is not accepting entries');
    if (comp.entry_fee_cents === 0) throw new Error('This competition is free — no payment needed');

    // Apply promo code discount if provided
    let effectiveAmount = comp.entry_fee_cents;
    let appliedPromo: string | null = null;

    if (promoCode && typeof promoCode === 'string') {
      const code = promoCode.trim().toUpperCase();

      const { data: promo, error: promoError } = await supabase
        .from('promo_codes')
        .select('*')
        .eq('code', code)
        .single();

      if (promoError || !promo) {
        throw new Error('Invalid promo code');
      }

      // Validate promo is active and not expired
      if (!promo.active) {
        throw new Error('This promo code is no longer active');
      }
      if (promo.expires_at && new Date(promo.expires_at) < new Date()) {
        throw new Error('This promo code has expired');
      }
      if (promo.uses_remaining !== null && promo.uses_remaining <= 0) {
        throw new Error('This promo code has been fully redeemed');
      }

      // Calculate discount
      const discountPct = promo.discount_percent ?? 0;
      effectiveAmount = Math.max(0, Math.round(comp.entry_fee_cents * (1 - discountPct / 100)));
      appliedPromo = code;

      // Decrement uses_remaining
      if (promo.uses_remaining !== null) {
        await supabase
          .from('promo_codes')
          .update({ uses_remaining: promo.uses_remaining - 1 })
          .eq('id', promo.id);
      }
    }

    // If 100% discount (free entry) — skip Stripe entirely
    if (effectiveAmount === 0) {
      return new Response(
        JSON.stringify({ free: true, appliedPromo }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create or get Stripe customer
    const { data: profile } = await supabase
      .from('profiles')
      .select('stripe_customer_id, display_name')
      .eq('id', user.id)
      .single();

    let customerId = profile?.stripe_customer_id;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: profile?.display_name || user.email,
        metadata: { supabase_uid: user.id },
      });
      customerId = customer.id;
      await supabase.from('profiles').update({ stripe_customer_id: customerId }).eq('id', user.id);
    }

    // Create PaymentIntent with the (possibly discounted) amount
    const paymentIntent = await stripe.paymentIntents.create({
      amount: effectiveAmount,
      currency: 'usd',
      customer: customerId,
      capture_method: 'automatic',
      metadata: {
        competition_id: competitionId,
        user_id: user.id,
        ...(appliedPromo ? { promo_code: appliedPromo } : {}),
      },
      description: `Podium — ${comp.name} entry fee${appliedPromo ? ` (promo: ${appliedPromo})` : ''}`,
    });

    return new Response(
      JSON.stringify({ clientSecret: paymentIntent.client_secret, paymentIntentId: paymentIntent.id, appliedPromo }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
