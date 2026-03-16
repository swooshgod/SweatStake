import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import Stripe from 'https://esm.sh/stripe@13.11.0?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

/**
 * stripe-webhook — receives Stripe events
 *
 * SECURITY:
 * - Verifies Stripe webhook signature on every request
 * - Uses upsert to prevent duplicate participants on retry
 */

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  apiVersion: '2023-10-16',
  httpClient: Stripe.createFetchHttpClient(),
});

serve(async (req) => {
  const signature = req.headers.get('stripe-signature');
  const body = await req.text();

  if (!signature) {
    return new Response('Missing stripe-signature header', { status: 400 });
  }

  // ── Verify webhook signature ──────────────────────────────────────────────
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEventAsync
      ? await stripe.webhooks.constructEventAsync(body, signature, Deno.env.get('STRIPE_WEBHOOK_SECRET')!)
      : stripe.webhooks.constructEvent(body, signature, Deno.env.get('STRIPE_WEBHOOK_SECRET')!);
  } catch (err) {
    console.warn('[stripe-webhook] Signature verification failed:', err.message);
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

      if (!competition_id || !user_id) {
        console.warn('[stripe-webhook] Missing metadata on PaymentIntent:', pi.id);
        break;
      }

      // ── Upsert participant (idempotent — safe on Stripe retries) ──────────
      const { error } = await supabase
        .from('participants')
        .upsert(
          {
            competition_id,
            user_id,
            paid: true,
            payment_intent_id: pi.id,
          },
          { onConflict: 'competition_id,user_id' }
        );

      if (error) {
        console.error('[stripe-webhook] Upsert failed:', error.message);
      } else {
        console.log(`[stripe-webhook] ✅ Payment confirmed: user ${user_id} joined competition ${competition_id}`);
      }
      break;
    }

    case 'payment_intent.payment_failed': {
      const pi = event.data.object as Stripe.PaymentIntent;
      const { competition_id, user_id } = pi.metadata;

      // Remove participant if they failed to pay
      if (competition_id && user_id) {
        await supabase
          .from('participants')
          .delete()
          .eq('competition_id', competition_id)
          .eq('user_id', user_id)
          .eq('paid', false);
      }

      console.log(`[stripe-webhook] ❌ Payment failed: user ${user_id} for competition ${competition_id}`);
      break;
    }

    case 'account.updated': {
      const account = event.data.object as Stripe.Account;
      if (account.charges_enabled) {
        await supabase
          .from('profiles')
          .update({ stripe_connect_account_id: account.id })
          .eq('stripe_connect_account_id', account.id);
        console.log(`[stripe-webhook] ✅ Connect account ready: ${account.id}`);
      }
      break;
    }

    case 'charge.refunded': {
      // Log refunds for audit trail
      const charge = event.data.object as Stripe.Charge;
      console.log(`[stripe-webhook] Refund processed for charge: ${charge.id}`);
      break;
    }

    default:
      console.log(`[stripe-webhook] Unhandled event type: ${event.type}`);
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
