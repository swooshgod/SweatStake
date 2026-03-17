/**
 * Podium — RevenueCat Webhook Handler
 * Syncs subscription status to Supabase when RevenueCat fires events.
 *
 * Set webhook URL in RevenueCat dashboard:
 * https://supabase.co/functions/v1/revenuecat-webhook
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

serve(async (req) => {
  // Verify RevenueCat webhook secret
  const webhookSecret = Deno.env.get('REVENUECAT_WEBHOOK_SECRET');
  const authHeader = req.headers.get('Authorization');

  if (webhookSecret && authHeader !== `Bearer ${webhookSecret}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  try {
    const event = await req.json();
    const { event: rcEvent } = event;

    if (!rcEvent) {
      return new Response('Invalid payload', { status: 400 });
    }

    const eventType = rcEvent.type;
    const appUserId = rcEvent.app_user_id; // This is the Supabase user ID we set on login
    const expiresAt = rcEvent.expiration_at_ms
      ? new Date(rcEvent.expiration_at_ms).toISOString()
      : null;
    const productId = rcEvent.product_id ?? '';

    // Map RevenueCat event types to our schema
    const ACTIVE_EVENTS = ['INITIAL_PURCHASE', 'RENEWAL', 'UNCANCELLATION', 'TRIAL_CONVERTED'];
    const INACTIVE_EVENTS = ['CANCELLATION', 'EXPIRATION', 'BILLING_ISSUE'];

    let isPro = false;
    let ourEventType: string = 'other';

    if (ACTIVE_EVENTS.includes(eventType)) {
      isPro = true;
      ourEventType = eventType === 'INITIAL_PURCHASE' ? 'subscribed'
        : eventType === 'RENEWAL' ? 'renewed'
        : 'subscribed';
    } else if (INACTIVE_EVENTS.includes(eventType)) {
      isPro = false;
      ourEventType = eventType === 'CANCELLATION' ? 'cancelled'
        : eventType === 'EXPIRATION' ? 'expired'
        : 'cancelled';
    } else if (eventType === 'TRIAL_STARTED') {
      isPro = true;
      ourEventType = 'trial_started';
    } else {
      // Unhandled event type — just acknowledge
      return new Response(JSON.stringify({ received: true }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Update user's Pro status
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        is_pro: isPro,
        pro_expires_at: expiresAt,
        pro_revenue_cat_id: appUserId,
      })
      .eq('id', appUserId);

    if (updateError) {
      console.error('[RevenueCat webhook] Profile update failed:', updateError.message);
      return new Response(JSON.stringify({ error: updateError.message }), { status: 500 });
    }

    // Log the event
    await supabase.from('subscription_events').insert({
      user_id: appUserId,
      event_type: ourEventType,
      product_id: productId,
      expires_at: expiresAt,
    });

    // If Pro activated, award trust score bonus
    if (isPro) {
      await supabase.rpc('adjust_trust_score', {
        p_user_id: appUserId,
        p_delta: 5,
        p_reason: 'pro_subscription_activated',
      });
    }

    console.log(`[RevenueCat] ${eventType} for user ${appUserId} — isPro: ${isPro}`);

    return new Response(JSON.stringify({ received: true }), {
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (err) {
    console.error('[RevenueCat webhook] Error:', err);
    return new Response(JSON.stringify({ error: 'Internal error' }), { status: 500 });
  }
});
