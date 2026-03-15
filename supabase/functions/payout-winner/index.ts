import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import Stripe from 'https://esm.sh/stripe@13.11.0?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { ethers } from 'https://esm.sh/ethers@5.7.2';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  apiVersion: '2023-10-16',
  httpClient: Stripe.createFetchHttpClient(),
});

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// USDC on Base
const USDC_BASE = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
const PODIUM_WALLET = '0xa2c36B289198734a9a5c9e4F7e31102d27eDf8e7';
const SERVICE_FEE_PCT = 0.10;

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Auth check — only allow service role or competition creator
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('Unauthorized');

    const { competitionId } = await req.json();

    // Get competition + winner
    const { data: comp } = await supabase
      .from('competitions')
      .select('*, profiles!winner_id(stripe_connect_account_id, wallet_address)')
      .eq('id', competitionId)
      .single();

    if (!comp) throw new Error('Competition not found');
    if (comp.status === 'completed') throw new Error('Already paid out');
    if (!comp.winner_id) throw new Error('No winner set');

    // Get winner participant
    const { data: winner } = await supabase
      .from('participants')
      .select('user_id, total_points, profiles(display_name, stripe_connect_account_id, wallet_address)')
      .eq('competition_id', competitionId)
      .order('total_points', { ascending: false })
      .limit(1)
      .single();

    if (!winner) throw new Error('No winner found');

    const totalPot = comp.prize_pool_cents;
    const fee = Math.floor(totalPot * SERVICE_FEE_PCT);
    const winnerAmount = totalPot - fee;

    let payoutResult: any = {};

    if (comp.payment_type === 'stripe') {
      // Stripe Connect payout
      const connectAccountId = winner.profiles?.stripe_connect_account_id;
      if (!connectAccountId) throw new Error('Winner has no Stripe Connect account');

      const transfer = await stripe.transfers.create({
        amount: winnerAmount,
        currency: 'usd',
        destination: connectAccountId,
        metadata: {
          competition_id: competitionId,
          winner_id: winner.user_id,
          total_pot_cents: totalPot,
          fee_cents: fee,
        },
        description: `Podium winnings — ${comp.name}`,
      });

      payoutResult = { method: 'stripe', transferId: transfer.id, amount: winnerAmount / 100 };

    } else if (comp.payment_type === 'usdc') {
      // USDC on Base payout
      const winnerAddress = winner.profiles?.wallet_address;
      if (!winnerAddress) throw new Error('Winner has no wallet address');

      const escrowKey = Deno.env.get('PODIUM_ESCROW_PRIVATE_KEY');
      if (!escrowKey) throw new Error('Escrow key not configured');

      const provider = new ethers.providers.JsonRpcProvider('https://mainnet.base.org');
      const wallet = new ethers.Wallet(escrowKey, provider);

      const usdcAbi = ['function transfer(address to, uint256 amount) returns (bool)'];
      const usdc = new ethers.Contract(USDC_BASE, usdcAbi, wallet);

      // winnerAmount is in cents, USDC has 6 decimals
      const usdcAmount = ethers.utils.parseUnits((winnerAmount / 100).toFixed(2), 6);
      const tx = await usdc.transfer(winnerAddress, usdcAmount);
      await tx.wait();

      payoutResult = { method: 'usdc', txHash: tx.hash, amount: winnerAmount / 100 };
    }

    // Mark competition as completed
    await supabase
      .from('competitions')
      .update({ status: 'completed', winner_id: winner.user_id })
      .eq('id', competitionId);

    // Update winner stats
    await supabase
      .from('profiles')
      .update({
        total_winnings: supabase.rpc('increment', { x: winnerAmount / 100 }),
        competitions_won: supabase.rpc('increment', { x: 1 }),
      })
      .eq('id', winner.user_id);

    return new Response(
      JSON.stringify({ success: true, payout: payoutResult }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
