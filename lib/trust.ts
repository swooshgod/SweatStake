/**
 * Podium — Trust Score System
 *
 * Every user has a trust score (0–100, default 50).
 * - Goes UP: completing clean competitions, account age, Apple Watch verified
 * - Goes DOWN: anomaly flags, community reports, suspicious patterns
 *
 * Auto-disqualification: score < 30 OR 3+ unique reports in a competition
 * Prize goes to next eligible (non-disqualified) participant.
 */

import { supabase } from './supabase';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const TRUST_THRESHOLDS = {
  DISQUALIFY: 30,  // below this = auto-disqualified from paid competitions
  WARNING: 45,     // yellow badge — new or flagged history
  TRUSTED: 70,     // green badge — clean record
  VERIFIED: 90,    // blue badge — long clean history + Watch verified
} as const;

export const MAX_REPORTS_BEFORE_REVIEW = 3; // unique reports triggers auto-flag

export type ReportReason =
  | 'impossible_stats'
  | 'device_mismatch'
  | 'suspicious_improvement'
  | 'multiple_accounts'
  | 'other';

export const REPORT_REASONS: Record<ReportReason, string> = {
  impossible_stats:       'Impossible stats (steps or calories way too high)',
  device_mismatch:        'Using a different device than registered',
  suspicious_improvement: 'Suspicious overnight improvement',
  multiple_accounts:      'Suspected multiple accounts / cheating',
  other:                  'Other suspicious activity',
};

// ---------------------------------------------------------------------------
// Trust badge display
// ---------------------------------------------------------------------------

export interface TrustBadge {
  label: string;
  color: string;
  bgColor: string;
  emoji: string;
}

export function getTrustBadge(score: number): TrustBadge {
  if (score >= TRUST_THRESHOLDS.VERIFIED) {
    return { label: 'Verified', color: '#3B82F6', bgColor: '#3B82F618', emoji: '✅' };
  }
  if (score >= TRUST_THRESHOLDS.TRUSTED) {
    return { label: 'Trusted', color: '#22C55E', bgColor: '#22C55E18', emoji: '🟢' };
  }
  if (score >= TRUST_THRESHOLDS.WARNING) {
    return { label: 'New', color: '#F59E0B', bgColor: '#F59E0B18', emoji: '🟡' };
  }
  return { label: 'Flagged', color: '#EF4444', bgColor: '#EF444418', emoji: '🚩' };
}

export function isEligibleForPaidCompetitions(score: number): boolean {
  return score >= TRUST_THRESHOLDS.DISQUALIFY;
}

// ---------------------------------------------------------------------------
// Get trust score
// ---------------------------------------------------------------------------

export async function getTrustScore(userId: string): Promise<number> {
  const { data, error } = await supabase
    .from('profiles')
    .select('trust_score')
    .eq('id', userId)
    .single();

  if (error || !data) return 50;
  return data.trust_score ?? 50;
}

// ---------------------------------------------------------------------------
// Community reports
// ---------------------------------------------------------------------------

/**
 * Check if the current user has already reported someone in this competition.
 */
export async function hasAlreadyReported(
  reporterId: string,
  reportedId: string,
  competitionId: string
): Promise<boolean> {
  const { data } = await supabase
    .from('community_reports')
    .select('id')
    .eq('reporter_id', reporterId)
    .eq('reported_id', reportedId)
    .eq('competition_id', competitionId)
    .maybeSingle();

  return !!data;
}

/**
 * Get the number of unique reports against a user in a competition.
 */
export async function getReportCount(
  reportedId: string,
  competitionId: string
): Promise<number> {
  const { count } = await supabase
    .from('community_reports')
    .select('*', { count: 'exact', head: true })
    .eq('reported_id', reportedId)
    .eq('competition_id', competitionId)
    .neq('status', 'dismissed');

  return count ?? 0;
}

/**
 * Submit a community report.
 * Returns success/error and whether they've already reported.
 */
export async function submitReport(
  reporterId: string,
  reportedId: string,
  competitionId: string,
  reason: ReportReason,
  details?: string
): Promise<{ success: boolean; error?: string; alreadyReported?: boolean }> {
  // Can't report yourself
  if (reporterId === reportedId) {
    return { success: false, error: 'You cannot report yourself.' };
  }

  // Check for duplicate report
  const already = await hasAlreadyReported(reporterId, reportedId, competitionId);
  if (already) {
    return { success: false, alreadyReported: true, error: "You've already reported this competitor." };
  }

  const { error } = await supabase.from('community_reports').insert({
    reporter_id: reporterId,
    reported_id: reportedId,
    competition_id: competitionId,
    reason,
    details: details ?? null,
    status: 'pending',
  });

  if (error) {
    console.warn('[Trust] Report insert failed:', error.message);
    return { success: false, error: 'Failed to submit report. Please try again.' };
  }

  // Check if this tips them over the threshold
  const reportCount = await getReportCount(reportedId, competitionId);
  if (reportCount >= MAX_REPORTS_BEFORE_REVIEW) {
    // Adjust trust score — multiple reports is a red flag
    await supabase.rpc('adjust_trust_score', {
      p_user_id: reportedId,
      p_delta: -5,
      p_reason: `community_reports_threshold_in_${competitionId}`,
    });
    console.log(`[Trust] User ${reportedId} flagged in competition ${competitionId} — ${reportCount} reports`);
  }

  return { success: true };
}

// ---------------------------------------------------------------------------
// Trust score adjustments
// ---------------------------------------------------------------------------

/**
 * Award trust points for completing a clean competition (no flags).
 */
export async function rewardCleanCompetition(userId: string): Promise<void> {
  await supabase.rpc('adjust_trust_score', {
    p_user_id: userId,
    p_delta: 3,
    p_reason: 'clean_competition_completed',
  });
}

/**
 * Award trust points for connecting Apple Watch.
 */
export async function rewardWatchConnection(userId: string): Promise<void> {
  await supabase.rpc('adjust_trust_score', {
    p_user_id: userId,
    p_delta: 5,
    p_reason: 'apple_watch_connected',
  });
}

/**
 * Penalize for anomaly flag.
 */
export async function penalizeAnomalyFlag(
  userId: string,
  severity: 'warn' | 'disqualify'
): Promise<void> {
  const delta = severity === 'disqualify' ? -15 : -5;
  await supabase.rpc('adjust_trust_score', {
    p_user_id: userId,
    p_delta: delta,
    p_reason: `anomaly_flag_${severity}`,
  });
}

/**
 * Check if a participant should be disqualified based on trust score + reports.
 * Returns disqualification info. Called before finalising competition results.
 */
export async function checkDisqualification(
  participantId: string,
  competitionId: string,
  userId: string
): Promise<{ disqualified: boolean; reason?: string }> {
  const { data, error } = await supabase.rpc('check_disqualification', {
    p_participant_id: participantId,
    p_competition_id: competitionId,
    p_user_id: userId,
  });

  if (error || !data) return { disqualified: false };
  return {
    disqualified: data.disqualified,
    reason: data.reason,
  };
}
