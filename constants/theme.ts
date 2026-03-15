export const Colors = {
  primary: '#E8856A',
  primaryDark: '#D4735A',
  secondary: '#111C30',
  accent: '#FFD700',
  background: '#0D1520',
  surface: '#111C30',
  surfaceLight: '#1A2740',
  success: '#22C55E',
  warning: '#F59E0B',
  error: '#EF4444',
  textPrimary: '#FFFFFF',
  textSecondary: '#94A3B8',
  textMuted: '#64748B',
  border: '#1E2D45',
  borderLight: '#162035',
  overlay: 'rgba(0,0,0,0.6)',
} as const;

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const;

export const BorderRadius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 9999,
} as const;

export const FontSize = {
  xs: 11,
  sm: 13,
  md: 15,
  lg: 17,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  hero: 40,
} as const;

export const Shadow = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
    elevation: 1,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 6,
  },
} as const;

export const CompetitionTypes = {
  fitness: { emoji: '\u{1F4AA}', label: 'Fitness', color: '#E8856A' },
  running: { emoji: '\u{1F3C3}', label: 'Running', color: '#3B82F6' },
  cycling: { emoji: '\u{1F6B4}', label: 'Cycling', color: '#10B981' },
  lifting: { emoji: '\u{1F3CB}\u{FE0F}', label: 'Lifting', color: '#8B5CF6' },
  custom: { emoji: '\u{2B50}', label: 'Custom', color: '#F59E0B' },
} as const;

export const ScoringTemplates = {
  full_challenge: {
    name: 'Full Challenge',
    description: 'Workout + Steps 8k + Water 80oz + Protein',
    categories: [
      { name: 'Workout', points: 3, auto_tracked: true, penalty: { threshold: 4, penaltyPerMissed: 1, maxPenalty: 3 } },
      { name: 'Steps (8,000+)', points: 2, auto_tracked: true },
      { name: 'Water (80oz)', points: 1, auto_tracked: false },
      { name: 'Protein Goal', points: 1, auto_tracked: false },
    ],
  },
  workout_streak: {
    name: 'Workout Streak',
    description: 'Workout days + consecutive bonus',
    categories: [
      { name: 'Workout', points: 3, auto_tracked: true },
      { name: 'Streak Bonus (3+ days)', points: 2, auto_tracked: false },
    ],
  },
  step_race: {
    name: 'Step Race',
    description: 'Steps only, auto from HealthKit',
    categories: [
      { name: 'Steps (10,000+)', points: 3, auto_tracked: true },
      { name: 'Steps (8,000+)', points: 2, auto_tracked: true },
      { name: 'Steps (5,000+)', points: 1, auto_tracked: true },
    ],
  },
  calorie_burn: {
    name: 'Calorie Burn',
    description: 'Active calories burned, auto from Apple Watch',
    categories: [
      { name: 'Calories (500+)', points: 3, auto_tracked: true },
      { name: 'Calories (300+)', points: 2, auto_tracked: true },
      { name: 'Calories (150+)', points: 1, auto_tracked: true },
    ],
  },
  weight_loss: {
    name: 'Weight Loss',
    description: 'Manual weigh-ins, most weight lost wins',
    categories: [
      { name: 'Weigh-in', points: 2, auto_tracked: false },
      { name: 'Workout', points: 3, auto_tracked: true },
    ],
  },
  improvement: {
    name: '% Improvement',
    description: 'Percentage improvement above your personal baseline',
    categories: [
      { name: 'Steps', points: 2, auto_tracked: true },
      { name: 'Workout', points: 3, auto_tracked: true },
      { name: 'Active Calories', points: 2, auto_tracked: true },
    ],
  },
  custom: {
    name: 'Custom',
    description: 'Define your own categories',
    categories: [],
  },
} as const;
