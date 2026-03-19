-- Migration: Add Tempo wallet address to profiles
-- Tempo is an EVM-compatible blockchain purpose-built for stablecoin payments
-- incubated by Paradigm + Stripe. Chain ID 4217, ~0.6s finality.
--
-- tempo_wallet_address: set when user creates a passkey wallet via wagmi/tempo
--   WebAuthn connector (Face ID / Touch ID, no seed phrase required)
-- wallet_address: legacy field — any EVM wallet (MetaMask, Coinbase, etc.)
--   compatible with Tempo network since it's EVM-compatible
--
-- Payout priority: tempo_wallet_address > wallet_address

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS tempo_wallet_address text;

-- Index for lookups during payout
CREATE INDEX IF NOT EXISTS profiles_tempo_wallet_idx ON profiles (tempo_wallet_address)
  WHERE tempo_wallet_address IS NOT NULL;

COMMENT ON COLUMN profiles.tempo_wallet_address IS
  'Tempo passkey wallet address (Face ID / Touch ID via wagmi/tempo WebAuthn). '
  'Preferred payout destination for USDC competitions. '
  'Created automatically during onboarding if user opts into crypto payouts.';
