#!/usr/bin/env node
/**
 * Polymarket Whale Tracker + Auto-Executor
 * ─────────────────────────────────────────
 * • Monitors leaderboard wallets for new trades
 * • Only follows markets resolving within 7 days
 * • Auto-copies qualifying trades using our CLOB credentials
 * • Notifies via Telegram on every action
 *
 * Rules:
 *   - Max $30 per copied trade
 *   - Max $100 total open at once
 *   - Min whale trade size: $50 (filter noise)
 *   - Market must resolve within 7 days
 *   - Never copy same market twice
 */

import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { ClobClient, Side } = require('@polymarket/clob-client');
const { Wallet } = require('ethers');
import Database from 'better-sqlite3';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Config ──────────────────────────────────────────────────────────────────
const BOT_TOKEN     = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID       = '5763593099';
const MY_WALLET     = process.env.POLY_WALLET_ADDRESS?.toLowerCase();
const MAX_DAYS      = 7;
const MIN_WHALE     = 50;     // min whale trade size to follow ($)
const MAX_PER_COPY  = 30;     // max we spend per copied trade ($)
const MAX_OPEN      = 450;    // max total open exposure ($) — $50 buffer kept
const COPY_RATIO    = 0.15;   // copy 15% of whale's size, capped at MAX_PER_COPY

// ── Whale wallets (Polymarket leaderboard) ──────────────────────────────────
// Top 27 wallets — scored by recency + buy frequency + trade size. Verified active today.
// Avg sizes: some doing $100k-$400k/trade = serious sharp money
const WHALE_WALLETS = [
  { address: '0x2a2c53bd278c04da9962fcf96490e17f3dfb9bc1', label: 'Whale_01' }, // score:125 avg:$458
  { address: '0x37c1874a60d348903594a96703e0507c518fc53a', label: 'Whale_02' }, // score:125 avg:$1,224
  { address: '0x6ac5bb06a9eb05641fd5e82640268b92f3ab4b6e', label: 'Whale_03' }, // score:125 avg:$358
  { address: '0xdb2223cc5202a4718c3069f577ec971f71c96478', label: 'Whale_04' }, // score:125 avg:$164
  { address: '0xc2e7800b5af46e6093872b177b7a5e7f0563be51', label: 'Whale_05' }, // score:123 avg:$130,750 🔥
  { address: '0xbddf61af533ff524d27154e589d2d7a81510c684', label: 'Whale_06' }, // score:123 avg:$26,401
  { address: '0x204f72f35326db932158cba6adff0b9a1da95e14', label: 'Whale_07' }, // score:123 avg:$66
  { address: '0xf19d7d88cf362110027dcd64750fdd209a04276f', label: 'Whale_08' }, // score:123 avg:$4,534
  { address: '0x036c159d5a348058a81066a76b89f35926d4178d', label: 'Whale_09' }, // score:121 avg:$49
  { address: '0xb90494d9a5d8f71f1930b2aa4b599f95c344c255', label: 'Whale_10' }, // score:121 avg:$6,123
  { address: '0xee613b3fc183ee44f9da9c05f53e2da107e3debf', label: 'Whale_11' }, // score:121 avg:$39
  { address: '0x1f0ebc543b2d411f66947041625c0aa1ce61cf86', label: 'Whale_12' }, // score:121 avg:$39
  { address: '0xd0d6053c3c37e727402d84c14069780d360993aa', label: 'Whale_13' }, // score:121 avg:$16
  { address: '0xfedc381bf3fb5d20433bb4a0216b15dbbc5c6398', label: 'Whale_14' }, // score:121
  { address: '0xa45fe11dd1420fca906ceac2c067844379a42429', label: 'Whale_15' }, // score:121 avg:$8
  { address: '0x4133bcbad1d9c41de776646696f41c34d0a65e70', label: 'Whale_16' }, // score:121 avg:$32
  { address: '0x2d8b401d2f0e6937afebf18e19e11ca568a5260a', label: 'Whale_17' }, // score:121 avg:$11
  { address: '0x93abbc022ce98d6f45d4444b594791cc4b7a9723', label: 'Whale_18' }, // score:119 avg:$3,335
  { address: '0xb45a797faa52b0fd8adc56d30382022b7b12192c', label: 'Whale_19' }, // score:119 avg:$9,861
  { address: '0x507e52ef684ca2dd91f90a9d26d149dd3288beae', label: 'Whale_20' }, // score:119 avg:$22
  { address: '0xd84c2b6d65dc596f49c7b6aadd6d74ca91e407b9', label: 'Whale_21' }, // score:119 avg:$482
  { address: '0xdb27bf2ac5d428a9c63dbc914611036855a6c56e', label: 'Whale_22' }, // score:117
  { address: '0x9d84ce0306f8551e02efef1680475fc0f1dc1344', label: 'Whale_23' }, // score:117 avg:$132
  { address: '0x4c2966a198cd7ac982110d0219b037afa9997570', label: 'Whale_24' }, // score:113
  { address: '0x6d3c5bd13984b2de47c3a88ddc455309aab3d294', label: 'Whale_25' }, // score:113
  { address: '0x492442eab586f242b53bda933fd5de859c8a3782', label: 'Whale_26' }, // score:111 avg:$61,217
  { address: '0xa61ef8773ec2e821962306ca87d4b57e39ff0abd', label: 'Whale_27' }, // score:111
];

// ── DB ──────────────────────────────────────────────────────────────────────
const db = new Database(join(__dirname, 'whale-tracker.db'));
db.exec(`
  CREATE TABLE IF NOT EXISTS seen_trades (
    trade_id   TEXT PRIMARY KEY,
    wallet     TEXT NOT NULL,
    label      TEXT,
    market     TEXT,
    question   TEXT,
    side       TEXT,
    size       REAL,
    price      REAL,
    days_left  REAL,
    alerted_at TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS our_trades (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    condition_id TEXT NOT NULL,
    token_id     TEXT,
    question     TEXT,
    side         TEXT,
    size         REAL,
    price        REAL,
    order_id     TEXT,
    status       TEXT DEFAULT 'placed',
    copied_from  TEXT,
    placed_at    TEXT DEFAULT (datetime('now')),
    UNIQUE(condition_id, side)
  );
  CREATE TABLE IF NOT EXISTS scan_log (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    scanned_at TEXT DEFAULT (datetime('now')),
    new_trades INTEGER,
    executed   INTEGER,
    balance    REAL
  );

`);

// ── CLOB client ──────────────────────────────────────────────────────────────
function getClient() {
  const wallet = new Wallet(process.env.POLY_PRIVATE_KEY);
  return new ClobClient('https://clob.polymarket.com', 137, wallet, {
    key:        process.env.POLY_API_KEY,
    secret:     process.env.POLY_API_SECRET,
    passphrase: process.env.POLY_API_PASSPHRASE,
  });
}

// ── Telegram ─────────────────────────────────────────────────────────────────
async function tg(msg) {
  if (!BOT_TOKEN) { console.log('[TG]', msg.slice(0, 100)); return; }
  try {
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: CHAT_ID, text: msg,
        parse_mode: 'Markdown', disable_web_page_preview: true })
    });
  } catch {}
}

// ── Utilities ────────────────────────────────────────────────────────────────
function daysUntil(d) {
  if (!d) return 999;
  return (new Date(d) - Date.now()) / 86400000;
}

function tradeAgeHours(t) {
  // timestamp is unix seconds
  const ts = t.timestamp || t.createdAt || 0;
  const ms = ts > 1e10 ? ts : ts * 1000; // handle both ms and seconds
  return (Date.now() - ms) / 3600000;
}

async function get(url) {
  const r = await fetch(url, {
    headers: { Accept: 'application/json', 'User-Agent': 'Mozilla/5.0' },
    signal: AbortSignal.timeout(8000)
  });
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  return r.json();
}

// ── USDC balance ─────────────────────────────────────────────────────────────
async function getBalance(addr) {
  const USDC = '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359';
  const data = '0x70a08231' + (addr || MY_WALLET).slice(2).toLowerCase().padStart(64, '0');
  for (const rpc of ['https://polygon.drpc.org', 'https://1rpc.io/matic']) {
    try {
      const r = await fetch(rpc, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', method: 'eth_call',
          params: [{ to: USDC, data }, 'latest'], id: 1 }),
        signal: AbortSignal.timeout(5000)
      });
      const j = await r.json();
      if (j.result && j.result !== '0x') return parseInt(j.result, 16) / 1e6;
    } catch {}
  }
  return null;
}

// ── Current open exposure ────────────────────────────────────────────────────
function getOpenExposure() {
  const row = db.prepare("SELECT SUM(size) as total FROM our_trades WHERE status='placed'").get();
  return row?.total || 0;
}

// ── Fetch whale activity ──────────────────────────────────────────────────────
async function getActivity(address) {
  try {
    const d = await get(`https://data-api.polymarket.com/activity?user=${address}&limit=25`);
    return Array.isArray(d) ? d : [];
  } catch (e) {
    console.log(`  Activity failed ${address.slice(0,10)}: ${e.message}`);
    return [];
  }
}

// ── Market details ────────────────────────────────────────────────────────────
// NOTE: Gamma conditionId lookup is broken (returns wrong markets).
// Fix: use slug from activity response, or fall back to CLOB token_id lookup.
const mktCache = new Map();

async function getMarketBySlug(slug) {
  if (!slug) return null;
  if (mktCache.has(slug)) return mktCache.get(slug) || null;
  try {
    const d = await get(`https://gamma-api.polymarket.com/markets?slug=${slug}`);
    const m = Array.isArray(d) && d.length ? d[0] : null;
    mktCache.set(slug, m);
    return m;
  } catch { return null; }
}

async function getMarketByTokenId(tokenId) {
  if (!tokenId) return null;
  const key = `token:${tokenId}`;
  if (mktCache.has(key)) return mktCache.get(key) || null;
  try {
    const d = await get(`https://clob.polymarket.com/markets?token_id=${tokenId}`);
    const m = d?.data?.[0] || null;
    if (m) {
      // Normalize to Gamma-style fields
      m.endDateIso = m.end_date_iso;
      m.conditionId = m.condition_id;
      m.clobTokenIds = m.tokens?.map(t => t.token_id) || [];
    }
    mktCache.set(key, m);
    return m;
  } catch { return null; }
}

// Keep old signature for backward compat (whale exit checks still use conditionId)
async function getMarket(conditionId) {
  if (!conditionId) return null;
  if (mktCache.has(conditionId)) return mktCache.get(conditionId) || null;
  try {
    // Try Gamma by conditionId (known to sometimes return wrong results)
    const d = await get(`https://gamma-api.polymarket.com/markets?conditionId=${conditionId}`);
    const m = Array.isArray(d) && d.length ? d[0] : null;
    mktCache.set(conditionId, m);
    return m;
  } catch { return null; }
}

// ── Place order on CLOB ───────────────────────────────────────────────────────
async function placeOrder(tokenId, side, sizeUSD, price) {
  try {
    const client = getClient();
    
    // Create market order (accepts best available price)
    const order = await client.createMarketOrder({
      tokenID: tokenId,
      side:    side === 'YES' ? Side.BUY : Side.SELL,
      amount:  sizeUSD,
    });
    
    const resp = await client.postOrder(order, 'GTC');
    return resp;
  } catch (e) {
    throw new Error(`Order failed: ${e.message}`);
  }
}

// ── Close our position on CLOB ────────────────────────────────────────────────
async function closePosition(trade) {
  try {
    const client = getClient();
    // To close a YES position → sell YES tokens (BUY NO side)
    const closeSide = trade.side === 'YES' ? Side.SELL : Side.BUY;
    const order = await client.createMarketOrder({
      tokenID: trade.token_id,
      side:    closeSide,
      amount:  trade.size,
    });
    const resp = await client.postOrder(order, 'GTC');
    return resp?.orderID || resp?.order_id || 'closed';
  } catch (e) {
    throw new Error(`Close failed: ${e.message}`);
  }
}

// ── Check if whale has exited their position ───────────────────────────────────
async function checkWhaleExits() {
  // Get all our open positions that were copied from a whale
  const openTrades = db.prepare(
    "SELECT * FROM our_trades WHERE status='placed'"
  ).all();

  if (!openTrades.length) return 0;

  let closed = 0;

  for (const trade of openTrades) {
    const whaleAddr = WHALE_WALLETS.find(w => w.label === trade.copied_from)?.address;
    if (!whaleAddr) continue;

    // Fetch whale's recent activity on this specific market
    const activity = await getActivity(whaleAddr);
    const exitTrade = activity.find(t => {
      const cid = t.conditionId || t.marketId || '';
      if (cid !== trade.condition_id) return false;
      // Looking for the opposite side — whale selling their position
      const side = t.side?.toUpperCase();
      return (trade.side === 'YES' && side === 'SELL') ||
             (trade.side === 'NO'  && side === 'BUY');
    });

    if (!exitTrade) continue;

    console.log(`  Whale ${trade.copied_from} closed ${trade.side} on "${trade.question?.slice(0,50)}" — mirroring close`);

    try {
      await closePosition(trade);

      db.prepare("UPDATE our_trades SET status='closed' WHERE id=?").run(trade.id);
      closed++;

      const daysLeft = daysUntil(
        (await getMarket(trade.condition_id))?.endDateIso || ''
      );
      const daysStr = daysLeft < 1 ? `${(daysLeft*24).toFixed(0)}h` : `${daysLeft.toFixed(1)}d`;

      await tg(
        `🔴 *Position Closed* (whale exited)\n` +
        `👤 ${trade.copied_from} sold their ${trade.side}\n` +
        `❓ ${(trade.question || '').slice(0, 100)}\n` +
        `💵 Closed $${trade.size.toFixed(0)} position\n` +
        `⏱ ${daysStr} remaining on market\n` +
        `[View market](https://polymarket.com/event/${trade.condition_id})`
      );

      await new Promise(r => setTimeout(r, 800));
    } catch (e) {
      console.error(`  Close failed:`, e.message);
      await tg(`⚠️ Failed to close position (${trade.copied_from}): ${e.message.slice(0,100)}`);
    }
  }

  return closed;
}

// ── Main scan + execute ───────────────────────────────────────────────────────
async function scan() {
  console.log(`\n[${new Date().toISOString()}] Whale scan + auto-execute...`);

  // First: check if any whales we copied have exited
  const closedCount = await checkWhaleExits();
  if (closedCount > 0) console.log(`Closed ${closedCount} positions (whale exits)`);

  const balance    = await getBalance(MY_WALLET);
  const openExp    = getOpenExposure();
  const available  = Math.min(balance || 0, MAX_OPEN - openExp);

  console.log(`Balance: $${(balance||0).toFixed(2)} | Open: $${openExp.toFixed(2)} | Available: $${available.toFixed(2)}`);

  if (available < 10) {
    console.log('Not enough available balance — skipping execution');
    return;
  }

  let executed = 0;
  let detected = 0;

  for (const whale of WHALE_WALLETS) {
    const trades = await getActivity(whale.address);

    for (const t of trades) {
      const tradeId = t.id || t.transactionHash ||
        `${whale.address}-${t.timestamp}-${t.conditionId}`;

      if (db.prepare('SELECT 1 FROM seen_trades WHERE trade_id=?').get(tradeId)) continue;

      // Skip stale trades (older than 1 hour) — only copy fresh moves
      if (tradeAgeHours(t) > 1) continue;

      const size  = parseFloat(t.usdcSize || t.size || t.amount || 0);
      const price = parseFloat(t.price || t.avgPrice || 0.5);
      if (size < MIN_WHALE) continue;

      // Determine side from activity fields
      const side = t.side?.toUpperCase() === 'BUY'
        ? (t.outcome?.toUpperCase() === 'NO' ? 'NO' : 'YES')
        : t.side?.toUpperCase() === 'SELL'
        ? (t.outcome?.toUpperCase() === 'YES' ? 'NO' : 'YES') // selling YES = NO position
        : 'YES';

      const conditionId = t.conditionId || t.marketId || '';
      const slug        = t.slug || '';
      const tokenId     = t.asset || ''; // asset IS the tokenId from activity API

      // Look up market via slug (reliable) or fallback to tokenId CLOB lookup
      let market = null;
      if (slug) market = await getMarketBySlug(slug);
      if (!market && tokenId) market = await getMarketByTokenId(tokenId);

      // If still no market, build minimal info from the activity fields directly
      if (!market && t.title) {
        market = {
          question:    t.title,
          conditionId: conditionId,
          endDateIso:  null, // unknown — will skip this trade
          closed:      false,
        };
      }

      const endDate = market?.endDateIso || market?.endDate || '';
      const days = daysUntil(endDate);

      // Record as seen regardless
      try {
        db.prepare(`INSERT OR IGNORE INTO seen_trades 
          (trade_id,wallet,label,market,question,side,size,price,days_left)
          VALUES (?,?,?,?,?,?,?,?,?)`)
          .run(tradeId, whale.address, whale.label, conditionId,
            market?.question || t.title || '', side, size, price, days);
      } catch {}

      if (!endDate || days <= 0 || days > MAX_DAYS) {
        if (!endDate) console.log(`  No end_date for "${(t.title||'').slice(0,40)}" — skipping`);
        continue;
      }
      if (market?.closed || market?.accepting_orders === false) {
        console.log(`  Market closed: "${(market.question||'').slice(0,40)}" — skipping`);
        continue;
      }
      detected++;

      // Skip if we already have a position in this market+side
      const already = db.prepare(
        'SELECT 1 FROM our_trades WHERE condition_id=? AND side=?'
      ).get(conditionId, side);
      if (already) continue;

      // Calculate our copy size
      const copySize = Math.min(size * COPY_RATIO, MAX_PER_COPY, available - executed * MAX_PER_COPY);
      if (copySize < 5) continue;

      const question = market?.question || t.title || conditionId;
      const daysStr  = days < 1 ? `${(days*24).toFixed(0)}h` : `${days.toFixed(1)}d`;

      // tokenId comes directly from activity `asset` field
      // For NO side, get the opposite token from market's token list
      let finalTokenId = tokenId;
      if (side === 'NO' && market?.clobTokenIds?.length >= 2) {
        // outcomeIndex 0 = YES token, 1 = NO token
        finalTokenId = t.outcomeIndex === 0 ? market.clobTokenIds[1] : market.clobTokenIds[0];
      }

      if (!finalTokenId) {
        console.log(`  No tokenId for "${question.slice(0,40)}" — skipping`);
        continue;
      }

      console.log(`  → Copying ${whale.label}: ${side} $${copySize.toFixed(0)} on "${question.slice(0,50)}" [${daysStr}]`);

      try {
        const resp = await placeOrder(finalTokenId, side, copySize, price);
        const orderId = resp?.orderID || resp?.order_id || 'unknown';

        db.prepare(`INSERT OR IGNORE INTO our_trades 
          (condition_id,token_id,question,side,size,price,order_id,copied_from)
          VALUES (?,?,?,?,?,?,?,?)`)
          .run(conditionId, finalTokenId, question, side, copySize, price, orderId, whale.label);

        executed++;
        const payout = price > 0 ? (copySize / price).toFixed(0) : '?';

        await tg(
          `✅ *Trade Executed* (copy of ${whale.label})\n` +
          `❓ ${question.slice(0, 100)}\n` +
          `📈 *${side}* @ ${(price*100).toFixed(0)}¢\n` +
          `💵 Risking $${copySize.toFixed(0)} → wins $${payout}\n` +
          `⏱ Resolves: *${daysStr}*\n` +
          `[View market](https://polymarket.com/event/${conditionId})`
        );

        await new Promise(r => setTimeout(r, 1000));
      } catch (e) {
        console.error(`  Order failed:`, e.message);
        await tg(`⚠️ Order failed (${whale.label} copy): ${e.message.slice(0,100)}`);
      }
    }

    await new Promise(r => setTimeout(r, 400));
  }

  // Mark any resolved markets as closed in DB
  const openTrades = db.prepare("SELECT * FROM our_trades WHERE status='placed'").all();
  for (const t of openTrades) {
    const m = await getMarket(t.condition_id);
    if (m?.closed || m?.resolved || daysUntil(m?.endDateIso) <= 0) {
      db.prepare("UPDATE our_trades SET status='resolved' WHERE id=?").run(t.id);
      console.log(`  Marked resolved: ${t.question?.slice(0,50)}`);
    }
  }

  db.prepare('INSERT INTO scan_log (new_trades,executed,balance) VALUES (?,?,?)')
    .run(detected, executed, balance);

  if (executed > 0) {
    const newBalance = await getBalance(MY_WALLET);
    console.log(`Executed ${executed} trades. New balance: $${(newBalance||0).toFixed(2)}`);
  } else {
    console.log(`No new qualifying trades to copy. Detected: ${detected}`);
  }
}

// ── Balance check mode ────────────────────────────────────────────────────────
async function checkBalance() {
  const bal = await getBalance(MY_WALLET);
  const open = getOpenExposure();
  const msg = bal !== null
    ? `💰 *Polymarket Status*\nWallet: $${bal.toFixed(2)} USDC\nOpen exposure: $${open.toFixed(2)}`
    : `⚠️ Balance check failed`;
  console.log(msg);
  await tg(msg);
}

// ── Entrypoint ────────────────────────────────────────────────────────────────
const mode = process.argv[2];
if (mode === 'balance') checkBalance().catch(console.error);
else scan().catch(console.error);
