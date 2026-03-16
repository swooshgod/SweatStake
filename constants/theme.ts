// ─────────────────────────────────────────────
// Podium Design System
// Brand: Deep black + Championship Gold
// Energy: Premium, competitive, sports-prestige
// ─────────────────────────────────────────────

export const Colors = {
  // Brand
  primary:      '#F5C518',   // Championship gold — trophy, winner, prestige
  primaryDark:  '#D4A800',   // Pressed/dark gold
  primaryLight: '#FFD740',   // Light gold — highlights
  primaryGlow:  'rgba(245, 197, 24, 0.18)', // Gold glow for cards/badges

  // Backgrounds — deep rich black, not cold navy
  background:   '#0A0A0A',   // True near-black
  surface:      '#141414',   // Card surface
  surfaceLight: '#1E1E1E',   // Elevated surface
  surfaceHigh:  '#262626',   // Highest elevation

  // Accent
  accent:       '#F5C518',   // Same as primary (gold is the accent)
  accentBlue:   '#3B82F6',   // For % improvement mode
  accentGreen:  '#22C55E',   // Success / verified
  accentPurple: '#8B5CF6',   // Lifting / raw workouts

  // Status
  success:      '#22C55E',
  warning:      '#F59E0B',
  error:        '#EF4444',

  // Text
  textPrimary:   '#FFFFFF',
  textSecondary: '#A3A3A3',
  textMuted:     '#525252',

  // Borders
  border:       '#242424',
  borderLight:  '#1A1A1A',
  borderGold:   'rgba(245, 197, 24, 0.25)',  // Gold border for active states

  // Overlay
  overlay:      'rgba(0, 0, 0, 0.75)',
} as const;

// ─── Gradients ───────────────────────────────
// Use with expo-linear-gradient
export const Gradients = {
  // Hero gradient — welcome screen / competition headers
  hero: ['rgba(0,0,0,0.0)', 'rgba(0,0,0,0.6)', 'rgba(0,0,0,0.95)'] as string[],

  // Gold shimmer — prize amounts, winner banners
  gold: ['#F5C518', '#D4A800', '#F5C518'] as string[],

  // Card overlay — competition cards with photo backgrounds
  card: ['rgba(10,10,10,0)', 'rgba(10,10,10,0.85)'] as string[],

  // Surface gradient — subtle depth on cards
  surface: ['#1E1E1E', '#141414'] as string[],

  // Winner celebration
  winner: ['#F5C518', '#FF8C00'] as string[],
} as const;

// ─── Spacing ─────────────────────────────────
export const Spacing = {
  xs:   4,
  sm:   8,
  md:   12,
  lg:   16,
  xl:   20,
  xxl:  24,
  xxxl: 32,
  huge: 48,
} as const;

// ─── Border Radius ───────────────────────────
export const BorderRadius = {
  sm:   8,
  md:   12,
  lg:   16,
  xl:   24,
  xxl:  32,
  full: 9999,
} as const;

// ─── Font Sizes ──────────────────────────────
export const FontSize = {
  xs:   11,
  sm:   13,
  md:   15,
  lg:   17,
  xl:   20,
  xxl:  26,
  xxxl: 34,
  hero: 44,
} as const;

// ─── Shadows ─────────────────────────────────
export const Shadow = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 5,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 24,
    elevation: 10,
  },
  // Gold glow — use on primary buttons and prize amounts
  gold: {
    shadowColor: '#F5C518',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
  },
  // Subtle gold glow — use on active competition cards
  goldSm: {
    shadowColor: '#F5C518',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
} as const;

// ─── Competition Types ────────────────────────
export const CompetitionTypes = {
  fitness: { emoji: '💪', label: 'Fitness',  color: '#F5C518' },  // Gold
  running: { emoji: '🏃', label: 'Running',  color: '#3B82F6' },  // Blue
  cycling: { emoji: '🚴', label: 'Cycling',  color: '#22C55E' },  // Green
  lifting: { emoji: '🏋️', label: 'Lifting',  color: '#8B5CF6' },  // Purple
  custom:  { emoji: '⭐', label: 'Custom',   color: '#F59E0B' },  // Amber
} as const;

// ─── Scoring Templates ───────────────────────
export const ScoringTemplates = {
  step_race: {
    name: 'Step Race',
    description: 'Most steps wins — auto-tracked via iPhone or Apple Watch',
    categories: [
      { name: 'Steps (10,000+)', points: 3, auto_tracked: true },
      { name: 'Steps (8,000+)',  points: 2, auto_tracked: true },
      { name: 'Steps (5,000+)',  points: 1, auto_tracked: true },
    ],
  },
  improvement: {
    name: '% Improvement',
    description: 'Biggest improvement above your personal 7-day baseline',
    categories: [
      { name: 'Steps vs Baseline',           points: 3, auto_tracked: true },
      { name: 'Distance vs Baseline',        points: 2, auto_tracked: true },
      { name: 'Active Minutes vs Baseline',  points: 2, auto_tracked: true },
    ],
  },
  weight_loss: {
    name: 'Weight Loss %',
    description: 'Most % of body weight lost. Manual weigh-ins. Fair for all body types.',
    categories: [
      { name: 'Weekly weigh-in', points: 1, auto_tracked: false },
    ],
  },
  distance: {
    name: 'Distance Race',
    description: 'Most miles/km covered — running, walking, cycling. Auto-tracked via GPS.',
    categories: [
      { name: 'Distance (5+ miles)', points: 3, auto_tracked: true },
      { name: 'Distance (3+ miles)', points: 2, auto_tracked: true },
      { name: 'Distance (1+ mile)',  points: 1, auto_tracked: true },
    ],
  },
  active_minutes: {
    name: 'Active Minutes',
    description: 'Most minutes of any exercise — running, yoga, swimming, anything.',
    categories: [
      { name: 'Active Minutes (60+)', points: 3, auto_tracked: true },
      { name: 'Active Minutes (30+)', points: 2, auto_tracked: true },
      { name: 'Active Minutes (15+)', points: 1, auto_tracked: true },
    ],
  },
  full_challenge: {
    name: 'Full Challenge',
    description: 'Steps + Distance + Active Minutes — all auto-tracked',
    categories: [
      { name: 'Steps (8,000+)',       points: 2, auto_tracked: true },
      { name: 'Distance (2+ miles)',  points: 2, auto_tracked: true },
      { name: 'Active Min (30+)',     points: 2, auto_tracked: true },
    ],
  },
  custom: {
    name: 'Custom',
    description: 'Define your own categories',
    categories: [],
  },
} as const;
