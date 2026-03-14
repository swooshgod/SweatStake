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
}

export interface ScoringTemplate {
  categories: ScoringCategory[];
}

export type CompetitionType = 'fitness' | 'running' | 'cycling' | 'lifting' | 'custom';
export type CompetitionStatus = 'open' | 'active' | 'completed' | 'cancelled';
export type PaymentType = 'stripe' | 'usdc';

export interface Competition {
  id: string;
  creator_id: string;
  name: string;
  description: string | null;
  type: CompetitionType;
  scoring_template: ScoringTemplate;
  start_date: string;
  end_date: string;
  max_participants: number;
  entry_fee_cents: number;
  payment_type: PaymentType;
  prize_pool_cents: number;
  service_fee_pct: number;
  is_public: boolean;
  invite_code: string;
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
  startDate: Date;
  endDate: Date;
  maxParticipants: number;
  entryFeeCents: number;
  paymentType: PaymentType;
  isPublic: boolean;
}
