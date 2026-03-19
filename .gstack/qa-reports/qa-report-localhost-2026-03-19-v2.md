# QA Report — Podium (SweatStake) v2
**Date:** 2026-03-19
**URL:** http://localhost:8081
**Branch:** claude/install-gstack-qa-ZeYFu
**Previous Score:** 78 | **Current Score:** 88

---

## Summary

Round 2 QA after CORS config + deprecation warning fixes. All previously fixed issues remain fixed. Three new issues resolved in this round:

| # | Issue | Severity | Category | Status |
|---|-------|----------|----------|--------|
| ISSUE-001 | Web build crash from native-only Stripe import | critical | functional | fixed (round 1) |
| ISSUE-002 | CORS/network block on Supabase API calls | high | functional | mitigated |
| ISSUE-003 | First-launch screen layout broken on desktop | medium | visual | fixed (round 1) |
| ISSUE-004 | Auth header shows raw route group name | medium | ux | fixed (round 1) |
| ISSUE-005 | Deprecated React Native Web style warnings | low | console | fixed (round 1) |
| ISSUE-006 | Route warning for (auth)/welcome | low | console | fixed (round 1) |
| ISSUE-007 | Poor accessibility — minimal ARIA tree | medium | accessibility | fixed (round 1) |
| ISSUE-008 | shadow* deprecation warnings on web | medium | console | **fixed** |
| ISSUE-009 | First-launch page blank/dark on web | high | visual | **fixed** |
| ISSUE-010 | useNativeDriver warnings on web | low | console | **fixed** |

---

## Detailed Findings

### ISSUE-008: shadow* deprecation warnings (FIXED)
**Severity:** medium | **Category:** console
React Native Web warned about deprecated `shadowColor/shadowOffset/shadowOpacity/shadowRadius` props.
**Fix:** Created `shadow()` helper in `constants/theme.ts` that uses `Platform.select` — emits only `boxShadow` on web, only `shadow*` on native.

### ISSUE-009: First-launch page blank on web (FIXED)
**Severity:** high | **Category:** visual
The first-launch page rendered as nearly all-black. Three root causes:
1. `useNativeDriver: true` caused animation fallback issues — sequences didn't fire reliably
2. `LinearGradient` with `absoluteFill` rendered above content due to z-index stacking on web
3. Orange glow element rendered as solid orange circle instead of subtle diffused glow
**Fix:** Changed `useNativeDriver` to `Platform.OS !== 'web'`, added `zIndex` to content containers, used CSS `boxShadow` for web glow effect.

### ISSUE-010: useNativeDriver warnings (FIXED)
**Severity:** low | **Category:** console
All animation files used `useNativeDriver: true` which logged warnings on web.
**Fix:** Changed to `Platform.OS !== 'web'` across all files: `app/(tabs)/index.tsx`, `app/first-launch.tsx`, `components/CompetitionCard.tsx`, `components/ReportUserModal.tsx`.

### ISSUE-002: Supabase CORS (MITIGATED)
**Severity:** high | **Category:** functional
Supabase REST API returns CORS error from `http://localhost:8081`.
**Mitigation:** Added `supabase/config.toml` with `site_url = "https://podiumapp.fit"` and localhost redirect URLs. Updated `payout-winner` edge function with dynamic origin matching. Full fix requires Supabase dashboard CORS configuration for the hosted project.

---

## Category Scores

| Category | Score | Notes |
|----------|-------|-------|
| Console | 75 | shadow warnings gone; 1 pointerEvents warning from library; useNativeDriver warnings gone |
| Links | 100 | All internal nav works |
| Visual | 95 | Home, profile, first-launch all render correctly on desktop + mobile |
| Functional | 80 | App loads, pages render; Supabase API calls blocked by CORS in sandbox |
| UX | 90 | Clear CTAs, proper tab highlighting, good empty states |
| Performance | 100 | 469ms full page load |
| Content | 95 | All text readable, proper hierarchy |
| Accessibility | 80 | Buttons labeled, tabs have roles, interactive elements have ARIA |

**Weighted Health Score: 88**

---

## Evidence Screenshots

- Desktop home: `screenshots/qa2-home.png`
- Mobile home: `screenshots/qa2-mobile.png`
- First-launch desktop: `screenshots/qa2-first-launch.png`
- First-launch mobile: `screenshots/qa2-first-launch-mobile.png`
- Profile: `screenshots/qa2-profile.png`

---

## Remaining Items (not blocking 85+ target)

1. `props.pointerEvents` deprecation — from library code (expo-linear-gradient), not app code
2. Supabase CORS — requires dashboard config for hosted project, config.toml covers local dev
3. Pre-existing TypeScript errors in `app/create.tsx`, `lib/notifications.ts` (unrelated to QA changes)
