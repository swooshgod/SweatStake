export interface Profile {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  stripe_customer_id: string | null;
  wallet_address: string | null;
  total_winnings: number;
  competitions_entered: number;
  competitions_won: number;
  created_at: string;
}

export interface ScoringCategory {
  name: string;
  points: number;
  auto_tracked: boolean;
  penalty?: {
    threshold: number;       // minimum to avoid penalty (e.g. 4 workouts/week)
    penaltyPerMissed: number; // points lost per missed unit (e.g. -1 per workout under 4)
    maxPenalty: number;      // cap the penalty (e.g. -3 max)
  };
}

export interface ScoringTemplate {
  categories: ScoringCategory[];
}

export type CompetitionType = 'fitness' | 'running' | 'cycling' | 'lifting' | 'custom';
export type CompetitionStatus = 'open' | 'active' | 'completed' | 'cancelled';
export type PaymentType = 'stripe' | 'usdc';

export type ScoringMode =
  | 'relative_improvement'  // % above personal 7-day baseline (public default)
  | 'raw_steps'
  | 'raw_miles'
  | 'raw_calories'
  | 'raw_workouts'
  | 'weight_loss';          // lbs lost during competition period

export interface ScoringModeConfig {
  id: ScoringMode;
  label: string;
  description: string;
  unit: string;
  privateOnly: boolean;  // true = only available in private competitions
  requiresManualEntry?: boolean;  // weight_loss needs manual weigh-ins
}

export const SCORING_MODES: ScoringModeConfig[] = [
  { id: 'relative_improvement', label: '% Improvement', description: 'Compete on how much you improve above your personal baseline. Fair for all fitness levels.', unit: '%', privateOnly: false },
  { id: 'raw_steps', label: 'Most Steps', description: 'Total steps taken during the competition.', unit: 'steps', privateOnly: true },
  { id: 'raw_miles', label: 'Most Miles', description: 'Total distance covered during the competition.', unit: 'miles', privateOnly: true },
  { id: 'raw_calories', label: 'Most Calories', description: 'Total active calories burned.', unit: 'cal', privateOnly: true },
  { id: 'raw_workouts', label: 'Most Workouts', description: 'Total workout sessions completed.', unit: 'workouts', privateOnly: true },
  { id: 'weight_loss', label: 'Weight Loss', description: 'Most weight lost during the competition. Manual weigh-ins required.', unit: 'lbs', privateOnly: true, requiresManualEntry: true },
];

export interface CompetitionTemplate {
  id: string;
  name: string;
  description: string;
  metric: string;
  requiresWatch: boolean;
  icon: string;
}

export const COMPETITION_TEMPLATES: CompetitionTemplate[] = [
  {
    id: 'step_race',
    name: 'Step Race',
    description: 'Compete on daily step counts tracked by your iPhone',
    metric: 'steps',
    requiresWatch: false,
    icon: '👟',
  },
  {
    id: 'workout_streak',
    name: 'Workout Streak',
    description: 'Longest consecutive workout days wins — tracked via Apple Watch',
    metric: 'workouts',
    requiresWatch: true,
    icon: '🔥',
  },
  {
    id: 'calorie_burn',
    name: 'Calorie Burn',
    description: 'Highest active calories burned — requires Apple Watch for accuracy',
    metric: 'calories',
    requiresWatch: true,
    icon: '💥',
  },
  {
    id: 'active_minutes',
    name: 'Active Minutes',
    description: 'Most exercise minutes logged — requires Apple Watch rings',
    metric: 'activeMinutes',
    requiresWatch: true,
    icon: '⏱️',
  },
  {
    id: 'custom',
    name: 'Custom',
    description: 'Define your own categories and scoring',
    metric: 'custom',
    requiresWatch: false,
    icon: '⭐',
  },
];

export interface Competition {
  id: string;
  creator_id: string;
  name: string;
  description: string | null;
  type: CompetitionType;
  scoring_template: ScoringTemplate;
  scoring_mode: ScoringMode;
  start_date: string;
  end_date: string;
  max_participants: number;
  entry_fee_cents: number;
  payment_type: PaymentType;
  prize_pool_cents: number;
  service_fee_pct: number;
  is_public: boolean;
  is_private: boolean;
  invite_code: string;
  requires_watch: boolean;
  allow_before_photo: boolean;
  status: CompetitionStatus;
  winner_id: string | null;
  created_at: string;
  // Joined fields
  creator?: Profile;
  participant_count?: number;
}

export interface Participant {
  id: string;
  competition_id: string;
  user_id: string;
  joined_at: string;
  payment_intent_id: string | null;
  paid: boolean;
  total_points: number;
  current_streak: number;
  best_streak: number;
  rank: number | null;
  // Joined fields
  profile?: Profile;
}

export interface DailyLogEntries {
  workout?: boolean;
  steps?: number;
  water?: boolean;
  protein?: boolean;
  [key: string]: boolean | number | undefined;
}

export interface DailyLog {
  id: string;
  participant_id: string;
  log_date: string;
  entries: DailyLogEntries;
  points_earned: number;
  auto_synced: boolean;
  created_at: string;
}

export interface ExtraCreditLog {
  id: string;
  participant_id: string;
  credit_type: 'progress_photo' | 'check_in' | 'community_vote';
  metadata: Record<string, unknown>;
  awarded_at: string;
}

// Create competition form state
export interface CreateCompetitionForm {
  name: string;
  description: string;
  type: CompetitionType;
  scoringTemplate: string;
  categories: ScoringCategory[];
  scoringMode: ScoringMode;
  startDate: Date;
  endDate: Date;
  maxParticipants: number;
  entryFeeCents: number;
  paymentType: PaymentType;
  isPublic: boolean;
  isPrivate: boolean;
  requiresWatch: boolean;
  allowBeforePhoto: boolean;
}
