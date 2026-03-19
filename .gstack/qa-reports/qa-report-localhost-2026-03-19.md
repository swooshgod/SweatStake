# QA Report: Podium (SweatStake)

**URL:** http://localhost:8081
**Date:** 2026-03-19
**Duration:** ~8 minutes
**Pages visited:** 5 (Home, Profile, Welcome/Auth, First Launch, Create Competition redirect)
**Framework:** Expo SDK 54 + React Native Web
**Tier:** Standard
**Branch:** claude/install-gstack-qa-ZeYFu

---

## Health Score: 62/100

| Category | Score | Weight | Weighted |
|----------|-------|--------|----------|
| Console | 40 | 15% | 6.0 |
| Links | 100 | 10% | 10.0 |
| Visual | 75 | 10% | 7.5 |
| Functional | 75 | 20% | 15.0 |
| UX | 70 | 15% | 10.5 |
| Performance | 100 | 10% | 10.0 |
| Content | 92 | 5% | 4.6 |
| Accessibility | 40 | 15% | 6.0 |

---

## Top 3 Things to Fix

1. **ISSUE-001 (FIXED):** Web build crashes — `@stripe/stripe-react-native` imports native-only modules
2. **ISSUE-002:** CORS errors block all Supabase API calls on web
3. **ISSUE-003:** First-launch screen layout broken on desktop viewport

---

## Issues

### ISSUE-001: Web build crash from native-only Stripe import [Critical] [FIXED]
- **Category:** Functional
- **Severity:** Critical
- **Status:** verified
- **Commit:** ce144bc
- **Files Changed:** lib/stripe-native.ts, lib/stripe-native.web.ts, app/_layout.tsx, app/competition/[id].tsx, app/join/[code].tsx
- **Description:** The Metro bundler returns a 500 error because `@stripe/stripe-react-native` imports `react-native/Libraries/Utilities/codegenNativeCommands` which is native-only. The entire app fails to render on web.
- **Fix:** Created platform-specific shims (`stripe-native.ts` for native, `stripe-native.web.ts` for web) and updated all import sites.
- **Evidence:** screenshots/initial.png (before — blank page), screenshots/initial.png (after — app loads)

### ISSUE-002: CORS errors block Supabase API calls on web [High]
- **Category:** Functional
- **Severity:** High
- **Status:** deferred
- **Description:** All Supabase REST API calls from `http://localhost:8081` are blocked by CORS policy. The competitions list shows "No live competitions yet" because the fetch to Supabase fails.
- **Console error:** `Access to fetch at 'https://fdrrpdqemiqclyuvqxgs.supabase.co/rest/v1/competitions...' blocked by CORS policy`
- **Note:** This may be a Supabase project configuration issue (CORS allowed origins) rather than a code bug. Requires adding `http://localhost:8081` to Supabase CORS settings.

### ISSUE-003: First-launch screen layout broken on desktop [Medium]
- **Category:** Visual
- **Severity:** Medium
- **Status:** deferred
- **Description:** The orange gradient shape on the first-launch screen overflows and clips on the right side when viewed on desktop (1280x720). The layout is designed for mobile and doesn't adapt to wider viewports.
- **Evidence:** screenshots/first-launch.png

### ISSUE-004: Auth header shows raw route group name "(auth)" [Medium]
- **Category:** UX
- **Severity:** Medium
- **Status:** deferred
- **Description:** When navigating to the welcome/auth screen, the header title shows the raw Expo Router group name "(auth)" instead of a proper title like "Sign In" or no title.
- **Evidence:** screenshots/create-competition.png

### ISSUE-005: Deprecated React Native Web style warnings [Low]
- **Category:** Console
- **Severity:** Low
- **Status:** deferred
- **Description:** Multiple deprecation warnings in console:
  - `"textShadow*" style props are deprecated. Use "textShadow".`
  - `"shadow*" style props are deprecated. Use "boxShadow".`
  - `props.pointerEvents is deprecated. Use style.pointerEvents`
- **Note:** These are React Native Web 0.21 deprecations that should be addressed before upgrading.

### ISSUE-006: Route warning for "(auth)/welcome" [Low]
- **Category:** Console
- **Severity:** Low
- **Status:** deferred
- **Description:** Console warning: `No route named "(auth)/welcome" exists in nested children`. The route reference in code should be updated to match the actual route structure `(auth)`.

### ISSUE-007: Poor accessibility — minimal ARIA tree [Medium]
- **Category:** Accessibility
- **Severity:** Medium
- **Status:** deferred
- **Description:** The app's accessibility tree is minimal. The `snapshot -i` command found only tab elements in the ARIA tree. Most interactive elements (buttons, links, the "Create Competition" button) are not properly exposed to assistive technologies. The `snapshot -C` command found 23 clickable elements that aren't in the ARIA tree.

---

## Console Health Summary

- **Errors:** 2 unique errors (CORS block, resource load failure)
- **Warnings:** 5 unique warnings (deprecated styles, route naming, native driver)

---

## Performance

Page load time: 649ms (excellent)
- TTFB: 7ms
- DOM Ready: 443ms
- Full Load: 649ms

---

## Summary

- **Total issues found:** 7
- **Fixes applied:** 1 (verified: 1, best-effort: 0, reverted: 0)
- **Deferred issues:** 6
- **Health score:** 62/100

**PR Summary:** QA found 7 issues, fixed 1 (critical web build crash), health score 62.
