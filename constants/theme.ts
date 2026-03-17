// ─────────────────────────────────────────────
// Podium Design System — Dual Mode
// Light (default, daytime) + Dark (night)
// Energy: Premium, competitive, athletic
// ─────────────────────────────────────────────

// Light mode colors (default)
export const LightColors = {
  // Brand
  primary:      '#0057FF',   // Vivid electric blue
  primaryDark:  '#0040CC',
  primaryLight: '#338AFF',
  primaryGlow:  'rgba(0, 87, 255, 0.15)',

  // Backgrounds — very slight blue tint, feels premium
  background:   '#F5F7FF',
  surface:      '#FFFFFF',
  surfaceLight: '#EEF2FF',
  surfaceHigh:  '#E0E6F8',

  // Accent
  accent:       '#0057FF',
  accentBlue:   '#338AFF',
  accentGreen:  '#00C853',
  accentPurple: '#7C3AED',
  accentGold:   '#C9A84C',

  // Status
  success:      '#00C853',
  warning:      '#FFB300',
  error:        '#FF1744',

  // Text
  textPrimary:   '#050D2E',
  textSecondary: '#4A5580',
  textMuted:     '#8E9ABF',

  // Borders
  border:       '#D0D8F0',
  borderLight:  '#E0E6F8',
  borderAccent: 'rgba(0, 87, 255, 0.25)',
  borderGold:   'rgba(201, 168, 76, 0.30)',

  // Overlay
  overlay:      'rgba(0, 0, 0, 0.5)',
  tabBar:       '#FFFFFF',
  tabBarBorder: '#D0D8F0',
} as const;

// Dark mode colors
export const DarkColors = {
  // Brand
  primary:      '#0057FF',
  primaryDark:  '#0040CC',
  primaryLight: '#338AFF',
  primaryGlow:  'rgba(0, 87, 255, 0.15)',

  // Backgrounds — deep navy-black
  background:   '#060914',
  surface:      '#0F1A2E',
  surfaceLight: '#162040',
  surfaceHigh:  '#1E2A4A',

  // Accent
  accent:       '#0057FF',
  accentBlue:   '#338AFF',
  accentGreen:  '#00C853',
  accentPurple: '#8B5CF6',
  accentGold:   '#C9A84C',

  // Status
  success:      '#00C853',
  warning:      '#FFB300',
  error:        '#FF1744',

  // Text
  textPrimary:   '#F0F4FF',
  textSecondary: '#B0B8D4',
  textMuted:     '#4A5780',

  // Borders
  border:       '#1E2A4A',
  borderLight:  '#1A2540',
  borderAccent: 'rgba(0, 87, 255, 0.25)',
  borderGold:   'rgba(201, 168, 76, 0.35)',

  // Overlay
  overlay:      'rgba(0, 0, 0, 0.75)',
  tabBar:       '#0F1A2E',
  tabBarBorder: '#1A2540',
} as const;

// Default export — will be switched by ThemeContext
export const Colors = LightColors;

// ─── Gradients ───────────────────────────────
export const Gradients = {
  hero: ['rgba(0,0,0,0.0)', 'rgba(0,0,0,0.6)', 'rgba(0,0,0,0.95)'] as string[],
  gold: ['#0057FF', '#0040CC', '#338AFF'] as string[],
  card: ['rgba(6,9,20,0)', 'rgba(6,9,20,0.85)'] as string[],
  surface: ['#162040', '#0D1428'] as string[],
  winner: ['#0057FF', '#C9A84C'] as string[],
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

// ─── Shadows (Dark mode) ─────────────────────
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
  gold: {
    shadowColor: '#0057FF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
  },
  goldSm: {
    shadowColor: '#0057FF',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
} as const;

// ─── Shadows (Light mode) ────────────────────
export const ShadowLight = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 1,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 6,
  },
  gold: {
    shadowColor: '#0057FF',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 4,
  },
  goldSm: {
    shadowColor: '#0057FF',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 2,
  },
} as const;

// ─── Competition Types ────────────────────────
export const CompetitionTypes = {
  fitness: { emoji: '💪', label: 'Fitness',  color: '#0057FF' },
  running: { emoji: '🏃', label: 'Running',  color: '#338AFF' },
  cycling: { emoji: '🚴', label: 'Cycling',  color: '#00C853' },
  lifting: { emoji: '🏋️', label: 'Lifting',  color: '#8B5CF6' },
  custom:  { emoji: '⭐', label: 'Custom',   color: '#C9A84C' },
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
