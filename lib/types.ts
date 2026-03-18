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
  trust_score: number;
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
export type PaymentType = 'stripe' | 'usdc' | 'card';

export type TierLockMode = 'none' | 'within_one' | 'same';
export type FitnessTier = 'beginner' | 'active' | 'athlete' | 'elite';

export type ScoringMode =
  | 'relative_improvement'    // % above personal 7-day baseline
  | 'raw_steps'               // total steps
  | 'raw_miles'               // total miles/distance (walk, run, swim, cycle)
  | 'raw_weight_loss_pct'     // % body weight lost (manual weigh-ins)
  | 'raw_active_minutes'      // deprecated — kept for existing competitions only
  | 'raw_calories'            // deprecated — kept for existing competitions only
  | 'raw_workouts';           // deprecated — kept for existing competitions only

export interface ScoringModeConfig {
  id: ScoringMode;
  label: string;
  description: string;
  unit: string;
  privateOnly: boolean;  // true = only available in private competitions
}

export const SCORING_MODES: ScoringModeConfig[] = [
  { id: 'relative_improvement',  label: '% Improvement',    description: 'Compete on how much you improve above your personal baseline. Fair for all fitness levels.', unit: '%',       privateOnly: false },
  { id: 'raw_steps',             label: 'Most Steps',       description: 'Total steps taken during the competition. Auto-tracked via iPhone or Apple Watch.',           unit: 'steps',   privateOnly: true },
  { id: 'raw_miles',             label: 'Distance Race',    description: 'Total distance — walking, running, swimming, or cycling. Auto-tracked via GPS.',               unit: 'miles',   privateOnly: true },
  { id: 'raw_weight_loss_pct',   label: 'Weight Loss %',   description: 'Most % of body weight lost. Manual weigh-ins. Fair across all body sizes.',                   unit: '%',       privateOnly: false },
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
    description: 'Compete on daily step counts — auto-tracked via Apple Health',
    metric: 'steps',
    requiresWatch: false,
    icon: '👟',
  },
  {
    id: 'workout_streak',
    name: 'Workout Streak',
    description: 'Most workout days wins — auto-detected via Apple Watch',
    metric: 'workouts',
    requiresWatch: true,
    icon: '🔥',
  },
  {
    id: 'calorie_burn',
    name: 'Calorie Burn',
    description: 'Highest active calories burned — auto-tracked via Apple Watch',
    metric: 'calories',
    requiresWatch: true,
    icon: '💥',
  },
  {
    id: 'improvement',
    name: '% Improvement',
    description: 'Biggest improvement above your baseline — auto-tracked',
    metric: 'improvement',
    requiresWatch: false,
    icon: '📈',
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
  creator_tier: FitnessTier | null;
  tier_lock: TierLockMode;
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
  disqualified?: boolean;
  // Joined fields
  profile?: Profile;
}

export interface DailyLogEntries {
  workout?: boolean;
  steps?: number;
  activeCalories?: number;
  activeMinutes?: number;
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
  tierLock: TierLockMode;
}
