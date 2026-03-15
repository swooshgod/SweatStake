import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import Stripe from 'https://esm.sh/stripe@13.11.0?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  apiVersion: '2023-10-16',
  httpClient: Stripe.createFetchHttpClient(),
});

serve(async (req) => {
  const signature = req.headers.get('stripe-signature');
  const body = await req.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEventAsync
      ? await stripe.webhooks.constructEventAsync(body, signature!, Deno.env.get('STRIPE_WEBHOOK_SECRET')!)
      : stripe.webhooks.constructEvent(body, signature!, Deno.env.get('STRIPE_WEBHOOK_SECRET')!);
  } catch (err) {
    return new Response(`Webhook signature failed: ${err.message}`, { status: 400 });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  switch (event.type) {
    case 'payment_intent.succeeded': {
      const pi = event.data.object as Stripe.PaymentIntent;
      const { competition_id, user_id } = pi.metadata;

      if (!competition_id || !user_id) break;

      // Mark participant as paid
      await supabase
        .from('participants')
        .update({ paid: true, payment_intent_id: pi.id })
        .eq('competition_id', competition_id)
        .eq('user_id', user_id);

      // If not already a participant, insert them
      const { data: existing } = await supabase
        .from('participants')
        .select('id')
        .eq('competition_id', competition_id)
        .eq('user_id', user_id)
        .single();

      if (!existing) {
        await supabase.from('participants').insert({
          competition_id,
          user_id,
          paid: true,
          payment_intent_id: pi.id,
        });
      }

      console.log(`✅ Payment confirmed: user ${user_id} joined competition ${competition_id}`);
      break;
    }

    case 'payment_intent.payment_failed': {
      const pi = event.data.object as Stripe.PaymentIntent;
      const { competition_id, user_id } = pi.metadata;
      console.log(`❌ Payment failed: user ${user_id} for competition ${competition_id}`);
      break;
    }

    case 'account.updated': {
      // Stripe Connect account updated
      const account = event.data.object as Stripe.Account;
      if (account.charges_enabled) {
        await supabase
          .from('profiles')
          .update({ stripe_connect_account_id: account.id })
          .eq('stripe_connect_account_id', account.id);
        console.log(`✅ Connect account ready: ${account.id}`);
      }
      break;
    }
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
