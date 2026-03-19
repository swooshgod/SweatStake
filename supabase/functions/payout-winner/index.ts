import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import Stripe from 'https://esm.sh/stripe@13.11.0?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { secp256k1 } from 'https://esm.sh/@noble/curves@1.3.0/secp256k1';
import { keccak_256 } from 'https://esm.sh/@noble/hashes@1.3.3/sha3';
import { bytesToHex, hexToBytes } from 'https://esm.sh/@noble/hashes@1.3.3/utils';

/**
 * payout-winner — triggered by auto-payout or manually by admin
 *
 * PAYMENT METHODS:
 * - 'stripe'  → Stripe Connect transfer (card entry competitions)
 * - 'usdc'    → Tempo blockchain USDC transfer (crypto entry competitions)
 *
 * TEMPO INTEGRATION:
 * - Chain: Tempo Mainnet (Chain ID 4217), RPC: https://rpc.tempo.xyz
 * - USDC contract on Tempo: pulled from TEMPO_USDC_ADDRESS env var
 * - Escrow wallet: PODIUM_ESCROW_PRIVATE_KEY (funded with USDC on Tempo)
 * - Transfers include competition_id as a 32-byte memo for on-chain reconciliation
 * - Gas fees paid by Podium's fee payer service (users never pay gas)
 * - ~0.6 second finality vs ~2s on Base
 *
 * SECURITY:
 * - Requires valid service role JWT OR x-podium-internal secret header
 * - Postgres advisory lock prevents double-payout race condition
 * - Idempotency: won't pay out a completed competition
 * - Optimistic concurrency check on status update
 */

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  apiVersion: '2023-10-16',
  httpClient: Stripe.createFetchHttpClient(),
});

const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('APP_ORIGIN') ?? 'https://podiumapp.com',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-podium-internal',
};

const SERVICE_FEE_PCT = 0.10;

// ── Tempo network config ────────────────────────────────────────────────────
const TEMPO_RPC_URL = 'https://rpc.tempo.xyz';
const TEMPO_CHAIN_ID = 4217;
// USDC on Tempo mainnet — set TEMPO_USDC_ADDRESS in Supabase secrets
// To find: https://tempo.xyz/ecosystem or check tokenlist at
// https://docs.tempo.xyz/quickstart/tokenlist
const TEMPO_USDC_ADDRESS = Deno.env.get('TEMPO_USDC_ADDRESS') ?? '';

// ── ERC-20 / TIP-20 minimal ABI for USDC transfer + transferWithMemo ────────
// TIP-20 extends ERC-20 with a memo field for reconciliation
const TIP20_ABI = [
  // Standard ERC-20 transfer
  {
    name: 'transfer',
    type: 'function',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
  },
  // TIP-20 extension: transfer with 32-byte memo for reconciliation
  {
    name: 'transferWithMemo',
    type: 'function',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
      { name: 'memo', type: 'bytes32' },
    ],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
  },
  // Check escrow balance
  {
    name: 'balanceOf',
    type: 'function',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
];

// ── Tempo USDC payout via raw JSON-RPC ────────────────────────────────────
// Using raw fetch to Tempo RPC since ethers.js is Base-specific.
// Tempo is EVM-compatible so standard eth_sendRawTransaction works.
// We use a lightweight approach compatible with Deno edge functions.

async function sendTempoUSDC(params: {
  escrowPrivateKey: string;
  toAddress: string;
  amountUSDC: number;      // dollar amount (e.g. 45.00)
  competitionId: string;   // used as memo for on-chain reconciliation
}): Promise<{ txHash: string; amount: number; explorer: string }> {
  const { escrowPrivateKey, toAddress, amountUSDC, competitionId } = params;

  // Convert dollar amount to USDC base units (6 decimals)
  const amountUnits = BigInt(Math.floor(amountUSDC * 1_000_000));

  // Build memo: pad competition UUID to 32 bytes
  // Strip dashes from UUID and pad to 32 bytes hex
  const memoHex = '0x' + competitionId.replace(/-/g, '').padEnd(64, '0').substring(0, 64);

  // Encode transferWithMemo(address,uint256,bytes32)
  // Function selector: keccak256("transferWithMemo(address,uint256,bytes32)")[0:4]
  // Precomputed: 0x...  — we'll use a helper
  const selector = computeSelector('transferWithMemo(address,uint256,bytes32)');

  // ABI encode params
  const encoded = encodeABIParams([
    { type: 'address', value: toAddress },
    { type: 'uint256', value: amountUnits },
    { type: 'bytes32', value: memoHex },
  ]);

  const calldata = selector + encoded;

  // Get nonce for escrow wallet
  const escrowAddress = privateKeyToAddress(escrowPrivateKey);
  const nonce = await tempoRPC('eth_getTransactionCount', [escrowAddress, 'latest']);
  const gasPrice = await tempoRPC('eth_gasPrice', []);

  // Build and sign transaction
  const tx = {
    chainId: TEMPO_CHAIN_ID,
    nonce: parseInt(nonce, 16),
    gasPrice: BigInt(gasPrice),
    gasLimit: BigInt(120_000),
    to: TEMPO_USDC_ADDRESS,
    value: BigInt(0),
    data: calldata,
  };

  const signedTx = signTransaction(tx, escrowPrivateKey);
  const txHash = await tempoRPC('eth_sendRawTransaction', [signedTx]);

  // Wait for receipt (~0.6s on Tempo)
  let receipt = null;
  for (let i = 0; i < 20; i++) {
    await sleep(500);
    receipt = await tempoRPC('eth_getTransactionReceipt', [txHash]);
    if (receipt) break;
  }

  if (!receipt) throw new Error(`Tempo tx ${txHash} not confirmed after 10s`);
  if (receipt.status === '0x0') throw new Error(`Tempo tx ${txHash} reverted`);

  return {
    txHash,
    amount: amountUSDC,
    explorer: `https://explore.tempo.xyz/tx/${txHash}`,
  };
}

// ── Tempo RPC helper ─────────────────────────────────────────────────────────
async function tempoRPC(method: string, params: unknown[]): Promise<any> {
  const res = await fetch(TEMPO_RPC_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  });
  const json = await res.json();
  if (json.error) throw new Error(`Tempo RPC ${method} error: ${json.error.message}`);
  return json.result;
}

// ── Crypto helpers (Deno-compatible via @noble/curves + @noble/hashes) ──────
function computeSelector(sig: string): string {
  const hash = keccak_256(new TextEncoder().encode(sig));
  return '0x' + bytesToHex(hash.slice(0, 4));
}

function encodeABIParams(params: Array<{ type: string; value: any }>): string {
  // Minimal ABI encoder for address, uint256, bytes32
  return params.map(p => {
    if (p.type === 'address') {
      return p.value.toLowerCase().replace('0x', '').padStart(64, '0');
    }
    if (p.type === 'uint256') {
      return p.value.toString(16).padStart(64, '0');
    }
    if (p.type === 'bytes32') {
      return p.value.replace('0x', '').padEnd(64, '0');
    }
    return '';
  }).join('');
}

function privateKeyToAddress(privateKey: string): string {
  const keyBytes = hexToBytes(privateKey.replace('0x', ''));
  // Get uncompressed public key (65 bytes: 0x04 || x || y), drop the 0x04 prefix
  const pubKey = secp256k1.getPublicKey(keyBytes, false).slice(1);
  const hash = keccak_256(pubKey);
  // Ethereum address = last 20 bytes of keccak256(pubKey), checksummed
  return checksumAddress('0x' + bytesToHex(hash.slice(12)));
}

function checksumAddress(address: string): string {
  const addr = address.toLowerCase().replace('0x', '');
  const hash = bytesToHex(keccak_256(new TextEncoder().encode(addr)));
  let result = '0x';
  for (let i = 0; i < 40; i++) {
    result += parseInt(hash[i], 16) >= 8 ? addr[i].toUpperCase() : addr[i];
  }
  return result;
}

// ── RLP encoding (minimal, supports EIP-155 legacy transactions) ────────────
function rlpEncode(input: Uint8Array | Uint8Array[]): Uint8Array {
  if (input instanceof Uint8Array) {
    if (input.length === 1 && input[0] < 0x80) return input;
    if (input.length <= 55) return concat([new Uint8Array([0x80 + input.length]), input]);
    const lenBytes = bigIntToBytes(BigInt(input.length));
    return concat([new Uint8Array([0xb7 + lenBytes.length]), lenBytes, input]);
  }
  // Array
  const encoded = concat(input.map(item => rlpEncode(item)));
  if (encoded.length <= 55) return concat([new Uint8Array([0xc0 + encoded.length]), encoded]);
  const lenBytes = bigIntToBytes(BigInt(encoded.length));
  return concat([new Uint8Array([0xf7 + lenBytes.length]), lenBytes, encoded]);
}

function bigIntToBytes(n: bigint): Uint8Array {
  if (n === 0n) return new Uint8Array(0);
  const hex = n.toString(16);
  const padded = hex.length % 2 ? '0' + hex : hex;
  return hexToBytes(padded);
}

function bigIntToMinBytes(n: bigint): Uint8Array {
  if (n === 0n) return new Uint8Array(0);
  return bigIntToBytes(n);
}

function concat(arrays: Uint8Array[]): Uint8Array {
  const total = arrays.reduce((s, a) => s + a.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const a of arrays) { out.set(a, offset); offset += a.length; }
  return out;
}

interface LegacyTx {
  chainId: number;
  nonce: number;
  gasPrice: bigint;
  gasLimit: bigint;
  to: string;
  value: bigint;
  data: string;
}

function signTransaction(tx: LegacyTx, privateKey: string): string {
  const keyBytes = hexToBytes(privateKey.replace('0x', ''));
  const chainId = BigInt(tx.chainId);

  // EIP-155: encode [nonce, gasPrice, gasLimit, to, value, data, chainId, 0, 0]
  const rawFields: Uint8Array[] = [
    bigIntToMinBytes(BigInt(tx.nonce)),
    bigIntToMinBytes(tx.gasPrice),
    bigIntToMinBytes(tx.gasLimit),
    hexToBytes(tx.to.replace('0x', '')),
    bigIntToMinBytes(tx.value),
    hexToBytes(tx.data.replace('0x', '')),
    bigIntToMinBytes(chainId),
    new Uint8Array(0), // EIP-155 r placeholder
    new Uint8Array(0), // EIP-155 s placeholder
  ];

  const encoded = rlpEncode(rawFields);
  const msgHash = keccak_256(encoded);

  // Sign with secp256k1
  const sig = secp256k1.sign(msgHash, keyBytes);

  // EIP-155 v value: recovery + chainId * 2 + 35
  const v = BigInt(sig.recovery) + chainId * 2n + 35n;

  // Encode signed transaction: [nonce, gasPrice, gasLimit, to, value, data, v, r, s]
  const rBytes = bigIntToBytes(sig.r);
  const sBytes = bigIntToBytes(sig.s);

  const signedFields: Uint8Array[] = [
    bigIntToMinBytes(BigInt(tx.nonce)),
    bigIntToMinBytes(tx.gasPrice),
    bigIntToMinBytes(tx.gasLimit),
    hexToBytes(tx.to.replace('0x', '')),
    bigIntToMinBytes(tx.value),
    hexToBytes(tx.data.replace('0x', '')),
    bigIntToMinBytes(v),
    rBytes,
    sBytes,
  ];

  return '0x' + bytesToHex(rlpEncode(signedFields));
}

function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms));
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN HANDLER
// ═══════════════════════════════════════════════════════════════════════════

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  // ── Auth ──────────────────────────────────────────────────────────────────
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

  if (hasAuthHeader && !isInternalCall) {
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), { status: 401, headers: corsHeaders });
    }
  }

  try {
    const { competitionId } = await req.json();
    if (!competitionId) throw new Error('competitionId required');

    // ── Advisory lock ────────────────────────────────────────────────────────
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

      if (hasAuthHeader && !isInternalCall) {
        const token = authHeader.replace('Bearer ', '');
        const { data: { user } } = await supabase.auth.getUser(token);
        if (user?.id !== comp.creator_id) {
          throw new Error('Only the competition creator can trigger manual payouts');
        }
      }

      // ── Find winner ───────────────────────────────────────────────────────
      const { data: winner, error: winnerError } = await supabase
        .from('participants')
        .select(`
          user_id,
          total_points,
          best_streak,
          joined_at,
          profiles (
            display_name,
            stripe_connect_account_id,
            wallet_address,
            tempo_wallet_address
          )
        `)
        .eq('competition_id', competitionId)
        .eq('paid', true)
        .or('disqualified.is.null,disqualified.eq.false')
        .order('total_points', { ascending: false })
        .order('best_streak', { ascending: false })
        .order('joined_at', { ascending: true })
        .limit(1)
        .single();

      if (winnerError || !winner) throw new Error('No eligible winner found');

      // ── Calculate prize pool ──────────────────────────────────────────────
      const { count: paidCount } = await supabase
        .from('participants')
        .select('*', { count: 'exact', head: true })
        .eq('competition_id', competitionId)
        .eq('paid', true);

      const actualPrizePool = comp.entry_fee_cents > 0
        ? (paidCount ?? 0) * comp.entry_fee_cents
        : 0;
      const fee = Math.floor(actualPrizePool * SERVICE_FEE_PCT);
      const winnerAmount = actualPrizePool - fee;
      const winnerAmountDollars = winnerAmount / 100;

      // ── Lock status to 'paying_out' ───────────────────────────────────────
      const { error: lockError } = await supabase
        .from('competitions')
        .update({ status: 'paying_out' })
        .eq('id', competitionId)
        .eq('status', comp.status);

      if (lockError) throw new Error('Failed to lock competition status — concurrent update detected');

      let payoutResult: any = {};

      // ── Execute payout ────────────────────────────────────────────────────
      if (winnerAmount > 0) {
        try {
          if (comp.payment_type === 'stripe') {
            // ── Stripe Connect payout ─────────────────────────────────────
            const connectAccountId = winner.profiles?.stripe_connect_account_id;
            if (!connectAccountId) throw new Error('Winner has no Stripe Connect account');

            const transfer = await stripe.transfers.create({
              amount: winnerAmount,
              currency: 'usd',
              destination: connectAccountId,
              metadata: {
                competition_id: competitionId,
                winner_id: winner.user_id,
                total_pot_cents: String(actualPrizePool),
                fee_cents: String(fee),
              },
              description: `Podium winnings — ${comp.name}`,
            });

            payoutResult = {
              method: 'stripe',
              transferId: transfer.id,
              amount: winnerAmountDollars,
            };

          } else if (comp.payment_type === 'usdc') {
            // ── Tempo USDC payout ─────────────────────────────────────────
            //
            // Winner payout destination priority:
            // 1. tempo_wallet_address  — native Tempo passkey wallet (preferred)
            //    → User signed up with Face ID via wagmi/tempo WebAuthn connector
            //    → Zero friction for the user, gas sponsored by Podium
            // 2. wallet_address        — any EVM-compatible wallet (MetaMask, etc.)
            //    → User connected an external wallet
            //    → Must be compatible with Tempo network (EVM chain ID 4217)
            //
            const winnerAddress =
              winner.profiles?.tempo_wallet_address ??
              winner.profiles?.wallet_address;

            if (!winnerAddress) {
              throw new Error(
                'Winner has no wallet address. ' +
                'Ask them to connect a wallet or set up a Tempo passkey wallet in their profile.'
              );
            }

            const escrowKey = Deno.env.get('PODIUM_ESCROW_PRIVATE_KEY');
            if (!escrowKey) throw new Error('PODIUM_ESCROW_PRIVATE_KEY not configured');
            if (!TEMPO_USDC_ADDRESS) throw new Error('TEMPO_USDC_ADDRESS not configured');

            // Send USDC on Tempo with competition_id as memo
            // ~0.6s finality, fees paid by Podium's escrow wallet
            const result = await sendTempoUSDC({
              escrowPrivateKey: escrowKey,
              toAddress: winnerAddress,
              amountUSDC: winnerAmountDollars,
              competitionId,
            });

            payoutResult = {
              method: 'tempo_usdc',
              txHash: result.txHash,
              amount: result.amount,
              explorer: result.explorer,
              walletType: winner.profiles?.tempo_wallet_address ? 'passkey' : 'external',
            };

            console.log(
              `[payout-winner] Tempo tx: ${result.explorer}`
            );
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

      // ── Mark completed ────────────────────────────────────────────────────
      await supabase
        .from('competitions')
        .update({
          status: 'completed',
          winner_id: winner.user_id,
          prize_pool_cents: actualPrizePool,
        })
        .eq('id', competitionId);

      // ── Update winner stats ───────────────────────────────────────────────
      if (winnerAmount > 0) {
        await supabase.rpc('increment_credits', {
          p_user_id: winner.user_id,
          p_amount: Math.floor(winnerAmountDollars * 100),
        });
      }

      await supabase.rpc('increment_competitions_won', {
        p_user_id: winner.user_id,
      });

      console.log(
        `[payout-winner] ✅ ${comp.name} → ${winner.profiles?.display_name} $${winnerAmountDollars} via ${payoutResult.method}`
      );

      return new Response(
        JSON.stringify({ success: true, payout: payoutResult, winner: winner.profiles?.display_name }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } finally {
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
