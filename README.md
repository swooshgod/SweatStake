# SweatStake

Fitness competition app where users create and join exercise challenges with real money on the line. Built with Expo (React Native), Supabase, Stripe, and Apple HealthKit.

## Tech Stack

- **Framework**: Expo SDK 52 + React Native (TypeScript)
- **Navigation**: Expo Router (file-based)
- **Backend**: Supabase (auth + Postgres + RLS)
- **Payments**: Stripe (entry fees + payouts) + USDC
- **Health**: expo-health (Apple HealthKit integration)
- **Notifications**: expo-notifications

## Getting Started

```bash
# Install dependencies
npm install

# Start the development server
npx expo start

# Run on iOS simulator
npx expo run:ios
```

## Project Structure

```
app/
  _layout.tsx              # Root layout (Stack navigator)
  (tabs)/
    _layout.tsx            # Tab navigator (Home + Profile)
    index.tsx              # Home screen — active & public competitions
    profile.tsx            # Profile — stats, wallet, settings
  (auth)/
    _layout.tsx            # Auth layout
    welcome.tsx            # Sign in with Apple / Google
  competition/
    [id].tsx               # Competition detail — leaderboard, progress, rules
  create.tsx               # Multi-step competition creation flow
  join/
    [code].tsx             # Join via invite code/link

components/
  CompetitionCard.tsx      # Competition preview card
  LeaderboardRow.tsx       # Ranked participant row
  DailyChecklist.tsx       # Today's scoring checklist
  WeeklyCalendar.tsx       # Weekly completion calendar

lib/
  supabase.ts              # Supabase client
  healthkit.ts             # HealthKit helpers
  stripe.ts                # Stripe/payment helpers
  types.ts                 # TypeScript types

hooks/
  useAuth.ts               # Auth state + Sign in with Apple
  useCompetitions.ts       # Competition data hooks

constants/
  theme.ts                 # Colors, spacing, typography, scoring templates

supabase/
  migrations/
    001_initial.sql        # Full database schema with RLS policies
```

## Key Features

- **Browse without auth** — public competitions visible before sign-in
- **Multi-step competition creation** — type, scoring template, rules, review
- **Scoring templates** — Full Challenge, Workout Streak, Step Race, Custom
- **HealthKit auto-sync** — workouts + steps pulled automatically
- **Real-time leaderboard** — rankings update on every log entry
- **Invite system** — share via `sweatstake://join/[code]` deep links
- **Escrow payments** — entry fees held via Stripe PaymentIntent until competition ends
- **10% service fee** — deducted from prize pool on payout

## Environment Setup

1. Update `lib/supabase.ts` with your Supabase project URL and anon key
2. Update `lib/stripe.ts` with your Stripe publishable key
3. Run the migration in `supabase/migrations/001_initial.sql` against your database
4. Configure Apple Sign-In in your Apple Developer account
5. Set up Stripe Connect for payouts

## Deep Linking

The app supports deep links for joining competitions:
- `sweatstake://join/[code]`
- `https://sweatstake.app/join/[code]`
