export const Colors = {
  primary: '#FF4D4D',
  primaryDark: '#E04343',
  secondary: '#1A1A2E',
  accent: '#FFD700',
  background: '#F8F9FA',
  surface: '#FFFFFF',
  success: '#22C55E',
  warning: '#F59E0B',
  error: '#EF4444',
  textPrimary: '#1A1A2E',
  textSecondary: '#6B7280',
  textMuted: '#9CA3AF',
  border: '#E5E7EB',
  borderLight: '#F3F4F6',
  overlay: 'rgba(0,0,0,0.5)',
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
    shadowOpacity: 0.05,
    shadowRadius: 2,
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
} as const;

export const CompetitionTypes = {
  fitness: { emoji: '💪', label: 'Fitness', color: '#FF4D4D' },
  running: { emoji: '🏃', label: 'Running', color: '#3B82F6' },
  cycling: { emoji: '🚴', label: 'Cycling', color: '#10B981' },
  lifting: { emoji: '🏋️', label: 'Lifting', color: '#8B5CF6' },
  custom: { emoji: '⭐', label: 'Custom', color: '#F59E0B' },
} as const;

export const ScoringTemplates = {
  full_challenge: {
    name: 'Full Challenge',
    description: 'Workout + Steps 8k + Water 80oz + Protein',
    categories: [
      { name: 'Workout', points: 3, auto_tracked: true },
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
  custom: {
    name: 'Custom',
    description: 'Define your own categories',
    categories: [],
  },
} as const;
