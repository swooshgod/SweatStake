import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Share,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, BorderRadius, FontSize, Shadow, CompetitionTypes } from '@/constants/theme';
import { formatCents, formatPrizePool } from '@/lib/stripe';
import { useAuth } from '@/hooks/useAuth';
import { useCompetitionDetail } from '@/hooks/useCompetitions';
import { supabase } from '@/lib/supabase';
import { checkAppleWatchPaired, checkBaselineReadiness, getUserBaseline, getTierFromSteps, checkTierCompatibility, FITNESS_TIERS } from '@/lib/healthkit';
import { checkComplianceForPaidCompetition } from '@/lib/compliance';
import { competitionPrizeInCredits } from '@/lib/prizes';
import LeaderboardRow from '@/components/LeaderboardRow';
import DailyChecklist from '@/components/DailyChecklist';
import WeeklyCalendar from '@/components/WeeklyCalendar';
import { calculateWeeklyPenalty } from '@/lib/healthkit';
import type { DailyLogEntries, ScoringCategory, ScoringMode } from '@/lib/types';
import { SCORING_MODES } from '@/lib/types';

type Tab = 'leaderboard' | 'progress' | 'rules';

const SCORING_MODE_COLORS: Record<ScoringMode, string> = {
  relative_improvement: '#3B82F6',
  raw_steps: '#8B5CF6',
  raw_miles: '#EC4899',
  raw_calories: '#F59E0B',
  raw_workouts: '#10B981',
};

export default function CompetitionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { profile } = useAuth();
  const { competition, participants, loading, refetch } = useCompetitionDetail(id);
  const [activeTab, setActiveTab] = useState<Tab>('leaderboard');
  const [todayEntries, setTodayEntries] = useState<DailyLogEntries>({});
  const [joining, setJoining] = useState(false);

  const myParticipant = participants.find((p) => p.user_id === profile?.id);
  const typeInfo = competition ? CompetitionTypes[competition.type] ?? CompetitionTypes.custom : CompetitionTypes.custom;

  const daysLeft = competition
    ? Math.max(0, Math.ceil((new Date(competition.end_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : 0;

  const totalDays = competition
    ? Math.ceil((new Date(competition.end_date).getTime() - new Date(competition.start_date).getTime()) / (1000 * 60 * 60 * 24))
    : 0;

  const handleShare = async () => {
    if (!competition) return;
    try {
      await Share.share({
        message: `Join my Podium competition "${competition.name}"! Use code: ${competition.invite_code}\n\nhttps://podiumapp.com/join/${competition.invite_code}`,
      });
    } catch (error) {
      console.error('Share error:', error);
    }
  };

  const handleJoin = async () => {
    if (!profile || !competition) return;

    setJoining(true);
    try {
      // 1. Compliance check (geo-blocking, age verification, skill-game)
      if (competition.entry_fee_cents > 0) {
        const compliance = await checkComplianceForPaidCompetition(profile.id, competition);

        if (!compliance.allowed) {
          if (compliance.requiresAgeVerification) {
            // Send to age verification screen, return here after
            Alert.alert(
              'Age Verification Required',
              'You must verify your age before joining paid competitions.',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Verify Age',
                  onPress: () => router.push('/(onboarding)/age-verify'),
                },
              ]
            );
          } else {
            Alert.alert('Not Available', compliance.reason ?? 'Paid competitions are not available in your region.');
          }
          return;
        }
      }

      // 2. Baseline readiness check for % Improvement competitions
      if (competition.scoring_mode === 'relative_improvement') {
        const baseline = await checkBaselineReadiness();
        if (!baseline.canJoinImprovementCompetition && baseline.message) {
          Alert.alert(
            '📊 Not Enough Activity Data',
            baseline.message + '\n\nYou can still join free competitions or private competitions with raw scoring.',
            [
              { text: 'Got it', style: 'cancel' },
              ...(competition.entry_fee_cents === 0 ? [{ text: 'Join Anyway', onPress: async () => {
                // Allow joining free improvement competitions even without baseline
                const { error } = await supabase.from('participants').insert({
                  competition_id: competition.id,
                  user_id: profile.id,
                  paid: true,
                });
                if (!error) { Alert.alert('Joined!', 'Good luck! Your baseline will be calculated from your first week of data.'); refetch(); }
              }}] : []),
            ]
          );
          return;
        }
      }

      // 3. Tier compatibility check
      if (competition.creator_tier && competition.tier_lock && competition.tier_lock !== 'none') {
        const baseline = await getUserBaseline();
        if (baseline) {
          const joinerTier = getTierFromSteps(baseline.avgDailySteps);
          const { allowed, warning } = checkTierCompatibility(joinerTier, competition.creator_tier, competition.tier_lock);
          if (!allowed) {
            Alert.alert(
              '🔒 Tier Restricted',
              warning ?? 'This competition is restricted to certain fitness tiers.',
              [{ text: 'OK' }]
            );
            return;
          }
          if (warning) {
            // Show warning but allow them to proceed
            await new Promise<void>((resolve) => {
              Alert.alert('Heads Up', warning, [
                { text: 'Cancel', style: 'cancel', onPress: () => resolve() },
                { text: 'Join Anyway', onPress: () => resolve() },
              ]);
            });
          }
        }
      }

      // 4. Apple Watch requirement check
      if (competition.requires_watch) {
        const hasPaired = await checkAppleWatchPaired();
        if (!hasPaired) {
          if (__DEV__) {
            Alert.alert(
              'Apple Watch Required',
              'This competition requires Apple Watch for accurate tracking. No Watch detected — proceeding anyway (dev mode).',
            );
          } else {
            Alert.alert(
              'Apple Watch Required',
              'This competition requires Apple Watch for accurate tracking. Connect an Apple Watch to join.',
              [{ text: 'OK' }],
            );
            return;
          }
        }
      }

      // 3. Join the competition
      const { error } = await supabase.from('participants').insert({
        competition_id: competition.id,
        user_id: profile.id,
        paid: competition.entry_fee_cents === 0,
      });

      if (error) throw error;

      // 4. Show success with credits info for paid competitions
      if (competition.entry_fee_cents > 0) {
        const prizeCredits = competitionPrizeInCredits(
          Math.floor(competition.prize_pool_cents * 0.9) // 90% to winner
        );
        Alert.alert(
          "You're In! 🏆",
          `Welcome to "${competition.name}".\n\nWinner earns ${prizeCredits}.\n\nGood luck!`
        );
      } else {
        Alert.alert('Joined!', `You're in "${competition.name}". Good luck!`);
      }

      refetch();
    } catch (error) {
      Alert.alert('Error', 'Failed to join competition. You may already be in it.');
    } finally {
      setJoining(false);
    }
  };

  const handleSyncHealthKit = useCallback(
    async (data: DailyLogEntries) => {
      setTodayEntries(data);

      if (!myParticipant || !competition) return;

      const today = new Date().toISOString().split('T')[0];
      await supabase.from('daily_logs').upsert(
        {
          participant_id: myParticipant.id,
          log_date: today,
          entries: data,
          points_earned: 0,
          auto_synced: true,
        },
        { onConflict: 'participant_id,log_date' }
      );
    },
    [myParticipant, competition]
  );

  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - d.getDay() + i + 1);
    return {
      date: d.toISOString().split('T')[0],
      pointsEarned: 0,
      maxPoints: competition?.scoring_template?.categories?.reduce(
        (s: number, c: ScoringCategory) => s + c.points, 0
      ) ?? 7,
    };
  });

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  if (!competition) {
    return (
      <View style={styles.centered}>
        <Ionicons name="alert-circle-outline" size={48} color={Colors.textMuted} />
        <Text style={styles.errorText}>Competition not found</Text>
      </View>
    );
  }

  const categories: ScoringCategory[] = competition.scoring_template?.categories ?? [];
  const isPaid = competition.entry_fee_cents > 0;

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Competition header */}
        <View style={styles.header}>
          <View style={[styles.typeBadge, { backgroundColor: typeInfo.color + '18' }]}>
            <Text style={styles.typeEmoji}>{typeInfo.emoji}</Text>
            <Text style={[styles.typeLabel, { color: typeInfo.color }]}>{typeInfo.label}</Text>
          </View>
          <Text style={styles.competitionName}>{competition.name}</Text>

          {competition.description && (
            <Text style={styles.description}>{competition.description}</Text>
          )}

          {/* Stats bar */}
          <View style={styles.statsBar}>
            <View style={styles.statItem}>
              <Text style={styles.statItemValue}>
                {isPaid
                  ? competitionPrizeInCredits(Math.floor(competition.prize_pool_cents * 0.9))
                  : 'Free'}
              </Text>
              <Text style={styles.statItemLabel}>Prize</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statItemValue}>{participants.length}/{competition.max_participants}</Text>
              <Text style={styles.statItemLabel}>Players</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statItemValue}>{daysLeft}d</Text>
              <Text style={styles.statItemLabel}>Left</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statItemValue}>{totalDays}d</Text>
              <Text style={styles.statItemLabel}>Total</Text>
            </View>
          </View>

          {/* Action buttons */}
          <View style={styles.actionRow}>
            {!myParticipant && competition.status === 'open' && (
              <TouchableOpacity
                style={[styles.joinButton, joining && { opacity: 0.6 }]}
                onPress={handleJoin}
                disabled={joining}
              >
                {joining ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Ionicons name="flash" size={18} color="#fff" />
                    <Text style={styles.joinButtonText}>
                      Join{competition.entry_fee_cents > 0 ? ` — ${formatCents(competition.entry_fee_cents)}` : ' — Free'}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.shareButton} onPress={handleShare}>
              <Ionicons name="share-outline" size={18} color={Colors.primary} />
              <Text style={styles.shareButtonText}>Invite</Text>
            </TouchableOpacity>
          </View>

          {/* Age/region disclaimer for paid competitions */}
          {isPaid && !myParticipant && (
            <Text style={styles.complianceNote}>
              🔒 18+ only · Not available in all regions · Skill-based competition
            </Text>
          )}
        </View>

        {/* Tab bar */}
        <View style={styles.tabBar}>
          {(['leaderboard', 'progress', 'rules'] as Tab[]).map((tab) => (
            <TouchableOpacity
              key={tab}
              style={[styles.tab, activeTab === tab && styles.tabActive]}
              onPress={() => setActiveTab(tab)}
            >
              <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
                {tab === 'leaderboard' ? 'Leaderboard' : tab === 'progress' ? 'My Progress' : 'Rules'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Tab content */}
        {activeTab === 'leaderboard' && (
          <View style={styles.tabContent}>
            {participants.length > 0 ? (
              <View style={styles.leaderboardCard}>
                {participants.map((p) => (
                  <LeaderboardRow
                    key={p.id}
                    participant={p}
                    isCurrentUser={p.user_id === profile?.id}
                  />
                ))}
              </View>
            ) : (
              <View style={styles.emptyTab}>
                <Ionicons name="people-outline" size={48} color={Colors.textMuted} />
                <Text style={styles.emptyTabText}>No participants yet</Text>
              </View>
            )}
          </View>
        )}

        {activeTab === 'progress' && (
          <View style={styles.tabContent}>
            {myParticipant ? (
              <>
                <View style={styles.progressSummary}>
                  <View style={styles.progressStat}>
                    <Text style={styles.progressStatValue}>#{myParticipant.rank ?? '—'}</Text>
                    <Text style={styles.progressStatLabel}>Rank</Text>
                  </View>
                  <View style={styles.progressStat}>
                    <Text style={[styles.progressStatValue, { color: Colors.primary }]}>
                      {myParticipant.total_points}
                    </Text>
                    <Text style={styles.progressStatLabel}>Points</Text>
                  </View>
                  <View style={styles.progressStat}>
                    <Text style={[styles.progressStatValue, { color: Colors.accent }]}>
                      {myParticipant.current_streak}
                    </Text>
                    <Text style={styles.progressStatLabel}>Streak</Text>
                  </View>
                </View>

                <WeeklyCalendar days={weekDays} />

                {(() => {
                  const workoutCat = categories.find((c) => c.name === 'Workout' && c.penalty);
                  if (!workoutCat?.penalty) return null;
                  const dayOfWeek = new Date().getDay();
                  if (dayOfWeek < 4 && dayOfWeek > 0) return null;
                  const workoutsThisWeek = todayEntries.workout ? 1 : 0;
                  const penalty = calculateWeeklyPenalty(workoutsThisWeek, workoutCat);
                  if (penalty >= 0) return null;
                  const remaining = workoutCat.penalty.threshold - workoutsThisWeek;
                  return (
                    <View style={styles.penaltyWarning}>
                      <Text style={styles.penaltyWarningText}>
                        {'⚠️'} {remaining} more workout{remaining !== 1 ? 's' : ''} to avoid {penalty}pt penalty this week
                      </Text>
                    </View>
                  );
                })()}

                <DailyChecklist
                  categories={categories}
                  entries={todayEntries}
                  onSyncHealthKit={handleSyncHealthKit}
                />
              </>
            ) : (
              <View style={styles.emptyTab}>
                <Ionicons name="lock-closed-outline" size={48} color={Colors.textMuted} />
                <Text style={styles.emptyTabText}>Join this competition to track progress</Text>
              </View>
            )}
          </View>
        )}

        {activeTab === 'rules' && (
          <View style={styles.tabContent}>
            <View style={styles.rulesCard}>
              <View style={styles.ruleRow}>
                <Text style={styles.ruleLabel}>Duration</Text>
                <Text style={styles.ruleValue}>
                  {new Date(competition.start_date).toLocaleDateString()} — {new Date(competition.end_date).toLocaleDateString()}
                </Text>
              </View>
              <View style={styles.ruleRow}>
                <Text style={styles.ruleLabel}>Entry Fee</Text>
                <Text style={styles.ruleValue}>{formatCents(competition.entry_fee_cents)}</Text>
              </View>
              <View style={styles.ruleRow}>
                <Text style={styles.ruleLabel}>Prize</Text>
                <Text style={styles.ruleValue}>
                  {isPaid
                    ? competitionPrizeInCredits(Math.floor(competition.prize_pool_cents * 0.9))
                    : 'None'}
                </Text>
              </View>
              <View style={styles.ruleRow}>
                <Text style={styles.ruleLabel}>Max Players</Text>
                <Text style={styles.ruleValue}>{competition.max_participants}</Text>
              </View>
              <View style={styles.ruleRow}>
                <Text style={styles.ruleLabel}>Payment</Text>
                <Text style={styles.ruleValue}>{competition.payment_type === 'stripe' ? 'Card / Apple Pay' : 'USDC'}</Text>
              </View>
              <View style={styles.ruleRow}>
                <Text style={styles.ruleLabel}>Service Fee</Text>
                <Text style={styles.ruleValue}>{competition.service_fee_pct}%</Text>
              </View>
              <View style={styles.ruleRow}>
                <Text style={styles.ruleLabel}>Visibility</Text>
                <Text style={styles.ruleValue}>{competition.is_public ? 'Public' : 'Invite Only'}</Text>
              </View>
              <View style={styles.ruleRow}>
                <Text style={styles.ruleLabel}>Scoring</Text>
                <Text style={styles.ruleValue}>
                  {SCORING_MODES.find((m) => m.id === competition.scoring_mode)?.label ?? '% Improvement'}
                </Text>
              </View>
              <View style={styles.ruleRow}>
                <Text style={styles.ruleLabel}>Competition Type</Text>
                <Text style={[styles.ruleValue, { color: '#6366F1' }]}>Skill-Based ✓</Text>
              </View>

              {categories.length > 0 && (
                <>
                  <Text style={styles.rulesSubheading}>Scoring Categories</Text>
                  {categories.map((cat: ScoringCategory) => (
                    <View key={cat.name} style={styles.ruleRow}>
                      <Text style={styles.ruleLabel}>{cat.name}</Text>
                      <Text style={styles.ruleValue}>{cat.points} pts (auto)</Text>
                    </View>
                  ))}
                </>
              )}

              <View style={[styles.ruleRow, styles.ruleRowLast]}>
                <Text style={styles.ruleLabel}>Invite Code</Text>
                <Text style={[styles.ruleValue, { fontWeight: '800', color: Colors.primary }]}>
                  {competition.invite_code}
                </Text>
              </View>

              {isPaid && (
                <Text style={styles.skillNote}>
                  Podium competitions are skill-based contests determined entirely by athletic effort and performance improvement as measured by Apple Health. Winners are determined by objective, verifiable fitness metrics — not chance.
                </Text>
              )}
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scrollContent: { paddingBottom: 100 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background },
  errorText: { fontSize: FontSize.md, color: Colors.textMuted, marginTop: Spacing.md },
  header: { backgroundColor: Colors.surface, padding: Spacing.xl, paddingTop: Spacing.md, ...Shadow.sm },
  typeBadge: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', paddingHorizontal: Spacing.sm, paddingVertical: Spacing.xs, borderRadius: BorderRadius.sm, marginBottom: Spacing.md },
  typeEmoji: { fontSize: FontSize.sm, marginRight: Spacing.xs },
  typeLabel: { fontSize: FontSize.xs, fontWeight: '600' },
  competitionName: { fontSize: FontSize.xxl, fontWeight: '800', color: Colors.textPrimary, marginBottom: Spacing.sm },
  description: { fontSize: FontSize.md, color: Colors.textSecondary, lineHeight: 22, marginBottom: Spacing.lg },
  badge: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', paddingHorizontal: Spacing.sm, paddingVertical: 3, borderRadius: BorderRadius.full, marginBottom: Spacing.md },
  badgeIcon: { fontSize: FontSize.xs },
  badgeText: { fontSize: FontSize.xs, fontWeight: '600' },
  statsBar: { flexDirection: 'row', backgroundColor: Colors.background, borderRadius: BorderRadius.lg, paddingVertical: Spacing.md, marginBottom: Spacing.lg },
  statItem: { flex: 1, alignItems: 'center' },
  statItemValue: { fontSize: FontSize.sm, fontWeight: '800', color: Colors.textPrimary },
  statItemLabel: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 2 },
  statDivider: { width: 1, backgroundColor: Colors.border },
  actionRow: { flexDirection: 'row', gap: Spacing.md },
  joinButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.primary, paddingVertical: Spacing.md, borderRadius: BorderRadius.lg, gap: Spacing.sm, ...Shadow.md },
  joinButtonText: { color: '#fff', fontSize: FontSize.md, fontWeight: '700' },
  shareButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: Spacing.md, paddingHorizontal: Spacing.xl, borderRadius: BorderRadius.lg, borderWidth: 1.5, borderColor: Colors.primary + '40', gap: Spacing.sm },
  shareButtonText: { color: Colors.primary, fontSize: FontSize.md, fontWeight: '700' },
  complianceNote: { fontSize: 11, color: Colors.textMuted, textAlign: 'center', marginTop: Spacing.md },
  tabBar: { flexDirection: 'row', backgroundColor: Colors.surface, marginTop: 1, paddingHorizontal: Spacing.lg, ...Shadow.sm },
  tab: { flex: 1, paddingVertical: Spacing.md, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: Colors.primary },
  tabText: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.textMuted },
  tabTextActive: { color: Colors.primary },
  tabContent: { padding: Spacing.lg },
  leaderboardCard: { backgroundColor: Colors.surface, borderRadius: BorderRadius.lg, overflow: 'hidden', ...Shadow.md },
  emptyTab: { alignItems: 'center', paddingVertical: Spacing.xxxl * 2 },
  emptyTabText: { fontSize: FontSize.md, color: Colors.textMuted, marginTop: Spacing.md },
  progressSummary: { flexDirection: 'row', gap: Spacing.md, marginBottom: Spacing.xl },
  progressStat: { flex: 1, backgroundColor: Colors.surface, borderRadius: BorderRadius.lg, padding: Spacing.lg, alignItems: 'center', ...Shadow.sm },
  progressStatValue: { fontSize: FontSize.xxl, fontWeight: '800', color: Colors.textPrimary },
  progressStatLabel: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: Spacing.xs },
  rulesCard: { backgroundColor: Colors.surface, borderRadius: BorderRadius.lg, padding: Spacing.lg, ...Shadow.md },
  rulesSubheading: { fontSize: FontSize.md, fontWeight: '700', color: Colors.textPrimary, marginTop: Spacing.lg, marginBottom: Spacing.md, paddingTop: Spacing.md, borderTopWidth: 1, borderTopColor: Colors.borderLight },
  ruleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  ruleRowLast: { borderBottomWidth: 0 },
  ruleLabel: { fontSize: FontSize.md, color: Colors.textSecondary },
  ruleValue: { fontSize: FontSize.md, fontWeight: '600', color: Colors.textPrimary },
  skillNote: { fontSize: 11, color: Colors.textMuted, lineHeight: 17, marginTop: Spacing.lg, paddingTop: Spacing.md, borderTopWidth: 1, borderTopColor: Colors.borderLight },
  penaltyWarning: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F59E0B18', borderRadius: BorderRadius.lg, paddingVertical: Spacing.md, paddingHorizontal: Spacing.lg, marginBottom: Spacing.lg, borderWidth: 1, borderColor: '#F59E0B40' },
  penaltyWarningText: { fontSize: FontSize.sm, fontWeight: '600', color: '#F59E0B' },
});
