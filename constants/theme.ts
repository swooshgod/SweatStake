// ─────────────────────────────────────────────
// Podium Design System — Dual Mode
// Light (default, daytime) + Dark (night)
// Energy: Premium, competitive, athletic
// ─────────────────────────────────────────────

// Light mode colors (default)
export const LightColors = {
  // Brand — Podium Orange
  primary:      '#FF5A1F',
  primaryDark:  '#E04A15',
  primaryLight: '#FF7A47',
  primaryGlow:  'rgba(255, 90, 31, 0.12)',

  // Backgrounds — clean off-white
  background:   '#F8F8F8',
  surface:      '#FFFFFF',
  surfaceLight: '#F2F2F0',
  surfaceHigh:  '#E8E8E5',

  // Accent
  accent:       '#FF5A1F',
  accentBlue:   '#338AFF',
  accentGreen:  '#00C853',
  accentPurple: '#7C3AED',
  accentGold:   '#C9A84C',

  // Status
  success:      '#00C853',
  warning:      '#FFB300',
  error:        '#FF1744',

  // Text
  textPrimary:   '#111111',
  textSecondary: '#555555',
  textMuted:     '#999999',

  // Borders
  border:       '#E0E0E0',
  borderLight:  '#EEEEEE',
  borderAccent: 'rgba(255, 90, 31, 0.25)',
  borderGold:   'rgba(201, 168, 76, 0.30)',

  // Overlay
  overlay:      'rgba(0, 0, 0, 0.5)',
  tabBar:       '#FFFFFF',
  tabBarBorder: '#E0E0E0',
} as const;

// Dark mode colors
export const DarkColors = {
  // Brand — Podium Orange
  primary:      '#FF5A1F',
  primaryDark:  '#E04A15',
  primaryLight: '#FF7A47',
  primaryGlow:  'rgba(255, 90, 31, 0.15)',

  // Backgrounds — true dark
  background:   '#111111',
  surface:      '#1E1E1E',
  surfaceLight: '#2A2A2A',
  surfaceHigh:  '#333333',

  // Accent
  accent:       '#FF5A1F',
  accentBlue:   '#338AFF',
  accentGreen:  '#00C853',
  accentPurple: '#8B5CF6',
  accentGold:   '#C9A84C',

  // Status
  success:      '#00C853',
  warning:      '#FFB300',
  error:        '#FF1744',

  // Text
  textPrimary:   '#F5F5F5',
  textSecondary: '#AAAAAA',
  textMuted:     '#666666',

  // Borders
  border:       '#333333',
  borderLight:  '#2A2A2A',
  borderAccent: 'rgba(255, 90, 31, 0.25)',
  borderGold:   'rgba(201, 168, 76, 0.35)',

  // Overlay
  overlay:      'rgba(0, 0, 0, 0.75)',
  tabBar:       '#1E1E1E',
  tabBarBorder: '#2A2A2A',
} as const;

// Default export — will be switched by ThemeContext
export const Colors = LightColors;

// ─── Gradients ───────────────────────────────
export const Gradients = {
  hero: ['rgba(0,0,0,0.0)', 'rgba(0,0,0,0.6)', 'rgba(0,0,0,0.95)'] as string[],
  gold: ['#FF5A1F', '#E04A15', '#FF7A47'] as string[],
  card: ['rgba(17,17,17,0)', 'rgba(17,17,17,0.85)'] as string[],
  surface: ['#2A2A2A', '#1E1E1E'] as string[],
  winner: ['#FF5A1F', '#C9A84C'] as string[],
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
    shadowColor: '#FF5A1F',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
  },
  goldSm: {
    shadowColor: '#FF5A1F',
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
    shadowColor: '#FF5A1F',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 4,
  },
  goldSm: {
    shadowColor: '#FF5A1F',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 2,
  },
} as const;

// ─── Competition Types ────────────────────────
export const CompetitionTypes = {
  fitness: { emoji: '💪', label: 'Fitness',  color: '#FF5A1F' },
  running: { emoji: '🏃', label: 'Running',  color: '#FF7A47' },
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
