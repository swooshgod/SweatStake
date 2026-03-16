import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Colors, Spacing, BorderRadius, FontSize, Shadow, CompetitionTypes } from '@/constants/theme';
import { formatCents, formatDollars } from '@/lib/stripe';
import { competitionPrizeInCredits } from '@/lib/prizes';
import { FITNESS_TIERS } from '@/lib/healthkit';
import type { Competition, ScoringMode, FitnessTier } from '@/lib/types';

interface Props {
  competition: Competition;
  variant?: 'full' | 'compact';
  viewerTier?: FitnessTier | null;
}

const SCORING_MODE_BADGES: Record<ScoringMode, { emoji: string; label: string; color: string }> = {
  relative_improvement: { emoji: '📈', label: '% Improvement', color: '#3B82F6' },
  raw_steps: { emoji: '👟', label: 'Most Steps', color: '#8B5CF6' },
  raw_miles: { emoji: '🏃', label: 'Most Miles', color: '#EC4899' },
  raw_calories: { emoji: '🔥', label: 'Most Calories', color: '#F59E0B' },
  raw_workouts: { emoji: '💪', label: 'Most Workouts', color: '#10B981' },
};

export default function CompetitionCard({ competition, variant = 'full', viewerTier }: Props) {
  const router = useRouter();
  const typeInfo = CompetitionTypes[competition.type] ?? CompetitionTypes.custom;
  const hasFee = competition.entry_fee_cents > 0;

  const daysLeft = Math.max(
    0,
    Math.ceil((new Date(competition.end_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
  );

  const participantCount = competition.participant_count ?? 0;
  const timeLabel = competition.status === 'completed' ? 'Done' : `${daysLeft}d left`;

  // Prize display — credits for paid, free for free
  const prizeDisplay = hasFee && competition.prize_pool_cents > 0
    ? competitionPrizeInCredits(Math.floor(competition.prize_pool_cents * 0.9))
    : 'Free';

  // Tier mismatch warnings
  const creatorTier = competition.creator_tier;
  const tierInfo = creatorTier ? FITNESS_TIERS[creatorTier] : null;
  const tierLock = competition.tier_lock ?? 'none';

  let tierWarning: 'above' | 'below' | null = null;
  if (viewerTier && creatorTier) {
    const { getTierIndex } = require('@/lib/healthkit');
    const diff = getTierIndex(viewerTier) - getTierIndex(creatorTier);
    if (diff >= 2) tierWarning = 'above';
    else if (diff <= -2) tierWarning = 'below';
  }

  return (
    <TouchableOpacity
      style={[
        styles.card,
        variant === 'compact' && styles.cardCompact,
        hasFee && styles.cardPaid,
        tierWarning === 'below' && styles.cardWarning,
      ]}
      activeOpacity={0.7}
      onPress={() => router.push(`/competition/${competition.id}`)}
    >
      {/* Tier mismatch banner */}
      {tierWarning === 'below' && (
        <View style={styles.difficultyBanner}>
          <Text style={styles.difficultyText}>⚠️ Above your fitness level</Text>
        </View>
      )}
      {tierWarning === 'above' && (
        <View style={[styles.difficultyBanner, styles.difficultyBannerEasy]}>
          <Text style={[styles.difficultyText, { color: Colors.success }]}>✅ Below your fitness level</Text>
        </View>
      )}

      {/* Top row */}
      <View style={styles.topRow}>
        <View style={styles.topLeft}>
          <View style={styles.nameRow}>
            <Text style={styles.typeEmoji}>{typeInfo.emoji}</Text>
            <Text style={styles.name} numberOfLines={1}>{competition.name}</Text>
          </View>
          <Text style={styles.meta}>
            {participantCount} joined · {timeLabel}
          </Text>
        </View>
        <View style={styles.potContainer}>
          <Text style={[styles.potAmount, !hasFee && styles.potFree]}>
            {!hasFee ? 'Free' : `$${(competition.prize_pool_cents * 0.9 / 100).toFixed(0)}`}
          </Text>
          {hasFee && <Text style={styles.potLabel}>prize</Text>}
        </View>
      </View>

      {/* Badge row */}
      <View style={styles.badgeRow}>
        {/* Tier badge */}
        {tierInfo && (
          <View style={[styles.badge, { backgroundColor: tierInfo.color + '20' }]}>
            <Text style={[styles.badgeText, { color: tierInfo.color }]}>
              {tierInfo.emoji} {tierInfo.label}
              {tierLock !== 'none' ? ' 🔒' : ''}
            </Text>
          </View>
        )}

        {/* Watch/iPhone */}
        {competition.requires_watch ? (
          <View style={[styles.badge, { backgroundColor: '#F59E0B18' }]}>
            <Text style={[styles.badgeText, { color: '#F59E0B' }]}>⌚ Watch</Text>
          </View>
        ) : (
          <View style={[styles.badge, { backgroundColor: '#22C55E18' }]}>
            <Text style={[styles.badgeText, { color: '#22C55E' }]}>📱 iPhone</Text>
          </View>
        )}

        {/* Scoring mode */}
        {competition.scoring_mode && (
          <View style={[styles.badge, { backgroundColor: (SCORING_MODE_BADGES[competition.scoring_mode]?.color ?? '#3B82F6') + '18' }]}>
            <Text style={[styles.badgeText, { color: SCORING_MODE_BADGES[competition.scoring_mode]?.color ?? '#3B82F6' }]}>
              {SCORING_MODE_BADGES[competition.scoring_mode]?.emoji}{' '}
              {SCORING_MODE_BADGES[competition.scoring_mode]?.label ?? '% Improvement'}
            </Text>
          </View>
        )}

        {/* Verified */}
        <View style={[styles.badge, { backgroundColor: '#22C55E18' }]}>
          <Text style={[styles.badgeText, { color: '#22C55E' }]}>✅ Verified</Text>
        </View>

        {/* Entry fee */}
        {hasFee && (
          <View style={[styles.badge, { backgroundColor: Colors.primaryGlow }]}>
            <Text style={[styles.badgeText, { color: Colors.primary }]}>
              {formatCents(competition.entry_fee_cents)} entry
            </Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
    ...Shadow.md,
  },
  cardCompact: {
    padding: Spacing.md,
    width: 280,
    marginRight: Spacing.md,
    marginBottom: 0,
  },
  cardPaid: {
    borderColor: Colors.primary + '40',
  },
  cardWarning: {
    borderColor: '#F59E0B40',
  },
  difficultyBanner: {
    backgroundColor: '#F59E0B18',
    marginHorizontal: -Spacing.lg,
    marginTop: -Spacing.lg,
    marginBottom: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: '#F59E0B30',
  },
  difficultyBannerEasy: {
    backgroundColor: '#22C55E18',
    borderBottomColor: '#22C55E30',
  },
  difficultyText: {
    fontSize: FontSize.xs,
    fontWeight: '700',
    color: '#F59E0B',
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.md,
  },
  topLeft: {
    flex: 1,
    marginRight: Spacing.md,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: 4,
  },
  typeEmoji: {
    fontSize: FontSize.lg,
  },
  name: {
    fontSize: FontSize.lg,
    fontWeight: '700',
    color: Colors.textPrimary,
    flex: 1,
  },
  meta: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginLeft: 26,
  },
  potContainer: {
    alignItems: 'flex-end',
  },
  potAmount: {
    fontSize: FontSize.xxl,
    fontWeight: '900',
    color: Colors.primary,
  },
  potFree: {
    color: Colors.success,
    fontSize: FontSize.lg,
  },
  potLabel: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    fontWeight: '600',
    marginTop: -2,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
  },
  badgeText: {
    fontSize: FontSize.xs,
    fontWeight: '600',
  },
});
