/**
 * USDC on Base — escrow payments for Podium competitions.
 *
 * Uses ethers v5 to interact with the USDC ERC-20 contract on Base mainnet.
 * All payout functions require the escrow wallet private key and
 * MUST run server-side (Supabase Edge Functions).
 */

import { ethers } from "ethers";
import { SERVICE_FEE_PCT } from "./payments";

// ── Base mainnet constants ──────────────────────────────────────────────────
const BASE_RPC = "https://mainnet.base.org";
const USDC_BASE = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"; // USDC on Base
const PODIUM_ESCROW_WALLET = "0xa2c36B289198734a9a5c9e4F7e31102d27eDf8e7";

const ERC20_ABI = [
  "function transfer(address to, uint256 amount) returns (bool)",
  "function balanceOf(address account) view returns (uint256)",
  "function decimals() view returns (uint8)",
];

// ── Helpers ─────────────────────────────────────────────────────────────────

function getProvider(): ethers.providers.JsonRpcProvider {
  return new ethers.providers.JsonRpcProvider(BASE_RPC);
}

function getUSDCContract(
  signerOrProvider: ethers.Signer | ethers.providers.Provider
): ethers.Contract {
  return new ethers.Contract(USDC_BASE, ERC20_ABI, signerOrProvider);
}

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Returns the Podium escrow wallet address (participants send entry fees here).
 */
export function getEscrowAddress(): string {
  return PODIUM_ESCROW_WALLET;
}

/**
 * Returns USDC balance for a wallet as a human-readable number (e.g. 549.90).
 */
export async function getUSDCBalance(address: string): Promise<number> {
  const provider = getProvider();
  const usdc = getUSDCContract(provider);
  const decimals: number = await usdc.decimals();
  const raw: ethers.BigNumber = await usdc.balanceOf(address);
  return parseFloat(ethers.utils.formatUnits(raw, decimals));
}

/**
 * Sends USDC on Base from one wallet to another.
 * Returns the transaction hash.
 */
export async function sendUSDC(
  toAddress: string,
  amount: number,
  privateKey: string
): Promise<string> {
  const provider = getProvider();
  const wallet = new ethers.Wallet(privateKey, provider);
  const usdc = getUSDCContract(wallet);
  const decimals: number = await usdc.decimals();
  const parsed = ethers.utils.parseUnits(amount.toFixed(decimals), decimals);

  const tx = await usdc.transfer(toAddress, parsed);
  const receipt = await tx.wait();
  return receipt.transactionHash;
}

/**
 * Pays out the winner from the Podium escrow wallet.
 * Sends 90% to the winner; the 10% service fee stays in escrow.
 *
 * ⚠️ Server-side only — requires the escrow wallet private key.
 */
export async function payoutWinnerUSDC(
  winnerAddress: string,
  totalPot: number,
  privateKey: string
): Promise<{ txHash: string; winnerAmount: number; fee: number }> {
  const fee = totalPot * SERVICE_FEE_PCT;
  const winnerAmount = totalPot - fee;

  const txHash = await sendUSDC(winnerAddress, winnerAmount, privateKey);
  return { txHash, winnerAmount, fee };
}
