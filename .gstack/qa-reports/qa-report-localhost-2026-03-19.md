# QA Report: Podium (SweatStake) — Re-test

**URL:** http://localhost:8081
**Date:** 2026-03-19
**Duration:** ~5 minutes (re-test)
**Pages visited:** 4 (Home, Profile, Welcome/Auth, First Launch)
**Framework:** Expo SDK 54 + React Native Web
**Tier:** Standard
**Branch:** claude/install-gstack-qa-ZeYFu

---

## Health Score: 78/100 (was 62 → +16)

| Category | Before | After | Weight | Weighted |
|----------|--------|-------|--------|----------|
| Console | 40 | 55 | 15% | 8.3 |
| Links | 100 | 100 | 10% | 10.0 |
| Visual | 75 | 90 | 10% | 9.0 |
| Functional | 75 | 75 | 20% | 15.0 |
| UX | 70 | 85 | 15% | 12.8 |
| Performance | 100 | 100 | 10% | 10.0 |
| Content | 92 | 92 | 5% | 4.6 |
| Accessibility | 40 | 70 | 15% | 10.5 |

**Total: 78.2 → 78**

---

## Issues Status

### ISSUE-001: Web build crash [Critical] — FIXED (previous session)
- **Commit:** ce144bc
- **Verified:** App loads on web, bundle compiles

### ISSUE-002: CORS/network block on Supabase API calls [High] — DEFERRED (environment)
- **Root cause:** Environment proxy blocks outbound HTTPS to `fdrrpdqemiqclyuvqxgs.supabase.co` with `403 host_not_allowed`. Not a CORS configuration issue — network-level block.
- **Impact on score:** Functional score capped because API data can't load on web in this environment

### ISSUE-003: First-launch screen layout on desktop [Medium] — FIXED
- **Commit:** 15432a2
- **Fix:** Replaced `Dimensions.get('window')` with percentage-based positioning, added `maxWidth` constraints, `overflow: hidden` on container
- **Before:** Orange glow overflowed off-screen right side
- **After:** Glow contained within viewport, content properly constrained to 480px max

### ISSUE-004: Auth header shows "(auth)" [Medium] — FIXED
- **Commit:** d667412
- **Fix:** Changed `Stack.Screen name` from `"(auth)/welcome"` to `"(auth)"` per Expo Router group naming
- **Before:** Raw "(auth)" text shown in header with back arrow
- **After:** Clean full-screen welcome page, no header

### ISSUE-005: Deprecated RN Web style warnings [Low] — FIXED
- **Commit:** b0d123b
- **Fix:** Added `boxShadow` CSS equivalents to theme Shadow objects, replaced `textShadow*` with shorthand `textShadow`, moved `pointerEvents` from prop to style
- **Before:** 5 deprecation warnings
- **After:** 2 remaining (from third-party libraries/framework, not fixable from app code)

### ISSUE-006: Route warning for (auth)/welcome [Low] — FIXED
- **Commit:** d667412 (same as ISSUE-004)
- **Before:** Console warning "No route named (auth)/welcome"
- **After:** No route warning

### ISSUE-007: Poor accessibility [Medium] — FIXED
- **Commit:** b6a66f2
- **Fix:** Added `accessibilityRole` and `accessibilityLabel` to all key interactive elements
- **Before:** ARIA tree showed only 2 tab elements
- **After:** ARIA tree shows 5+ elements (buttons, tabs with proper labels)
- **Evidence:** Initial snapshot showed 2 elements → re-test shows 5 labeled elements

---

## Performance

| Metric | Before | After |
|--------|--------|-------|
| Total load | 649ms | 470ms |
| TTFB | 7ms | 3ms |
| DOM Ready | 443ms | 323ms |

---

## Remaining Console Output

- **Errors:** 2 (CORS/network block — environment limitation)
- **Warnings:** 2 (shadow* from framework, useNativeDriver from RN Web — not fixable from app code)

---

## Summary

- **Total issues found:** 7
- **Fixes applied:** 6 (verified: 6, best-effort: 0, reverted: 0)
- **Deferred issues:** 1 (environment network block, not a code issue)
- **Health score delta:** 62 → 78 (+16)

**PR Summary:** QA found 7 issues, fixed 6, health score 62 → 78 (+16). Only remaining issue is environment-level network block to Supabase.
