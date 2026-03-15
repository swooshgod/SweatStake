import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Colors, Spacing, BorderRadius, FontSize, Shadow, CompetitionTypes } from '@/constants/theme';
import { formatCents } from '@/lib/stripe';
import type { Competition, ScoringMode } from '@/lib/types';

interface Props {
  competition: Competition;
  variant?: 'full' | 'compact';
}

const SCORING_MODE_BADGES: Record<ScoringMode, { emoji: string; label: string; color: string }> = {
  relative_improvement: { emoji: '\u{1F4C8}', label: '% Improvement', color: '#3B82F6' },
  raw_steps: { emoji: '\u{1F463}', label: 'Most Steps', color: '#8B5CF6' },
  raw_miles: { emoji: '\u{1F3C3}', label: 'Most Miles', color: '#EC4899' },
  raw_calories: { emoji: '\u{1F525}', label: 'Most Calories', color: '#F59E0B' },
  raw_workouts: { emoji: '\u{1F4AA}', label: 'Most Workouts', color: '#10B981' },
  weight_loss: { emoji: '\u{2696}\u{FE0F}', label: 'Weight Loss', color: '#6366F1' },
};

export default function CompetitionCard({ competition, variant = 'full' }: Props) {
  const router = useRouter();
  const typeInfo = CompetitionTypes[competition.type] ?? CompetitionTypes.custom;
  const hasFee = competition.entry_fee_cents > 0;

  const daysLeft = Math.max(
    0,
    Math.ceil(
      (new Date(competition.end_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    )
  );

  const potDisplay = competition.prize_pool_cents > 0
    ? formatCents(competition.prize_pool_cents)
    : 'Free';

  const participantCount = competition.participant_count ?? 0;
  const timeLabel = competition.status === 'completed' ? 'Done' : `${daysLeft}d left`;

  return (
    <TouchableOpacity
      style={[
        styles.card,
        variant === 'compact' && styles.cardCompact,
        hasFee && styles.cardPaid,
      ]}
      activeOpacity={0.7}
      onPress={() => router.push(`/competition/${competition.id}`)}
    >
      {/* Top row: name + type on left, pot on right */}
      <View style={styles.topRow}>
        <View style={styles.topLeft}>
          <View style={styles.nameRow}>
            <Text style={styles.typeEmoji}>{typeInfo.emoji}</Text>
            <Text style={styles.name} numberOfLines={1}>{competition.name}</Text>
          </View>
          <Text style={styles.meta}>
            {participantCount} joined {'\u{00B7}'} {timeLabel}
          </Text>
        </View>
        <View style={styles.potContainer}>
          <Text style={[styles.potAmount, potDisplay === 'Free' && styles.potFree]}>
            {potDisplay === 'Free' ? 'Free' : potDisplay}
          </Text>
          {potDisplay !== 'Free' && (
            <Text style={styles.potLabel}>pot</Text>
          )}
        </View>
      </View>

      {/* Bottom badges row */}
      <View style={styles.badgeRow}>
        {competition.requires_watch && (
          <View style={[styles.badge, { backgroundColor: '#F59E0B18' }]}>
            <Text style={[styles.badgeText, { color: '#F59E0B' }]}>{'\u{231A}'} Watch</Text>
          </View>
        )}
        {!competition.requires_watch && (
          <View style={[styles.badge, { backgroundColor: '#22C55E18' }]}>
            <Text style={[styles.badgeText, { color: '#22C55E' }]}>{'\u{1F4F1}'} iPhone</Text>
          </View>
        )}
        {competition.scoring_mode && (
          <View style={[
            styles.badge,
            { backgroundColor: (SCORING_MODE_BADGES[competition.scoring_mode]?.color ?? '#3B82F6') + '18' },
          ]}>
            <Text style={[
              styles.badgeText,
              { color: SCORING_MODE_BADGES[competition.scoring_mode]?.color ?? '#3B82F6' },
            ]}>
              {SCORING_MODE_BADGES[competition.scoring_mode]?.emoji}{' '}
              {SCORING_MODE_BADGES[competition.scoring_mode]?.label ?? '% Improvement'}
            </Text>
          </View>
        )}
        {hasFee && (
          <View style={[styles.badge, { backgroundColor: Colors.primary + '18' }]}>
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
    fontWeight: '800',
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
