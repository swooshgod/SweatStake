// ─────────────────────────────────────────────
// Podium Design System — Dual Mode
// Light (default, daytime) + Dark (night)
// Energy: Premium, competitive, athletic
// ─────────────────────────────────────────────

// Light mode colors (default)
export const LightColors = {
  // Brand
  primary:      '#FF5A1F',   // Electric orange
  primaryDark:  '#E04D15',
  primaryLight: '#FF7A45',
  primaryGlow:  'rgba(255, 90, 31, 0.12)',

  // Backgrounds — warm off-white, feels premium not clinical
  background:   '#F8F7F4',
  surface:      '#FFFFFF',
  surfaceLight: '#F2F0EC',
  surfaceHigh:  '#ECEAE4',

  // Accent
  accent:       '#FF5A1F',
  accentBlue:   '#2563EB',
  accentGreen:  '#16A34A',
  accentPurple: '#7C3AED',
  accentGold:   '#D97706',

  // Status
  success:      '#16A34A',
  warning:      '#D97706',
  error:        '#DC2626',

  // Text
  textPrimary:   '#0F0F0F',
  textSecondary: '#4B4B4B',
  textMuted:     '#9CA3AF',

  // Borders
  border:       '#E5E2DC',
  borderLight:  '#F0EDE8',
  borderAccent: 'rgba(255, 90, 31, 0.25)',
  borderGold:   'rgba(255, 90, 31, 0.30)',

  // Overlay
  overlay:      'rgba(0, 0, 0, 0.5)',
  tabBar:       '#FFFFFF',
  tabBarBorder: '#E5E2DC',
} as const;

// Dark mode colors
export const DarkColors = {
  // Brand
  primary:      '#FF5A1F',
  primaryDark:  '#E04D15',
  primaryLight: '#FF7A45',
  primaryGlow:  'rgba(255, 90, 31, 0.15)',

  // Backgrounds — deep rich black
  background:   '#0A0A0A',
  surface:      '#141414',
  surfaceLight: '#1E1E1E',
  surfaceHigh:  '#262626',

  // Accent
  accent:       '#FF5A1F',
  accentBlue:   '#3B82F6',
  accentGreen:  '#22C55E',
  accentPurple: '#8B5CF6',
  accentGold:   '#F5C518',

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
  borderAccent: 'rgba(255, 90, 31, 0.25)',
  borderGold:   'rgba(255, 90, 31, 0.35)',

  // Overlay
  overlay:      'rgba(0, 0, 0, 0.75)',
  tabBar:       '#141414',
  tabBarBorder: '#242424',
} as const;

// Default export — will be switched by ThemeContext
export const Colors = LightColors;

// ─── Gradients ───────────────────────────────
export const Gradients = {
  hero: ['rgba(0,0,0,0.0)', 'rgba(0,0,0,0.6)', 'rgba(0,0,0,0.95)'] as string[],
  gold: ['#FF5A1F', '#E04D15', '#FF7A45'] as string[],
  card: ['rgba(10,10,10,0)', 'rgba(10,10,10,0.85)'] as string[],
  surface: ['#1E1E1E', '#141414'] as string[],
  winner: ['#FF5A1F', '#FF8C00'] as string[],
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
  running: { emoji: '🏃', label: 'Running',  color: '#3B82F6' },
  cycling: { emoji: '🚴', label: 'Cycling',  color: '#22C55E' },
  lifting: { emoji: '🏋️', label: 'Lifting',  color: '#8B5CF6' },
  custom:  { emoji: '⭐', label: 'Custom',   color: '#F59E0B' },
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
