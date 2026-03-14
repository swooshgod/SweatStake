import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Colors, Spacing, BorderRadius, FontSize, Shadow, CompetitionTypes } from '@/constants/theme';
import { formatCents } from '@/lib/stripe';
import type { Competition } from '@/lib/types';

interface Props {
  competition: Competition;
  variant?: 'full' | 'compact';
}

export default function CompetitionCard({ competition, variant = 'full' }: Props) {
  const router = useRouter();
  const typeInfo = CompetitionTypes[competition.type] ?? CompetitionTypes.custom;

  const daysLeft = Math.max(
    0,
    Math.ceil(
      (new Date(competition.end_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    )
  );

  const statusColor =
    competition.status === 'open'
      ? Colors.success
      : competition.status === 'active'
        ? Colors.primary
        : Colors.textMuted;

  return (
    <TouchableOpacity
      style={[styles.card, variant === 'compact' && styles.cardCompact]}
      activeOpacity={0.7}
      onPress={() => router.push(`/competition/${competition.id}`)}
    >
      {/* Header row */}
      <View style={styles.header}>
        <View style={[styles.typeBadge, { backgroundColor: typeInfo.color + '18' }]}>
          <Text style={styles.typeEmoji}>{typeInfo.emoji}</Text>
          <Text style={[styles.typeLabel, { color: typeInfo.color }]}>{typeInfo.label}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: statusColor + '18' }]}>
          <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
          <Text style={[styles.statusText, { color: statusColor }]}>
            {competition.status.charAt(0).toUpperCase() + competition.status.slice(1)}
          </Text>
        </View>
      </View>

      {/* Title */}
      <Text style={styles.name} numberOfLines={2}>
        {competition.name}
      </Text>

      {variant === 'full' && competition.description && (
        <Text style={styles.description} numberOfLines={2}>
          {competition.description}
        </Text>
      )}

      {/* Stats row */}
      <View style={styles.statsRow}>
        <View style={styles.stat}>
          <Text style={styles.statValue}>
            {formatCents(competition.prize_pool_cents)}
          </Text>
          <Text style={styles.statLabel}>Prize Pool</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.stat}>
          <Text style={styles.statValue}>
            {competition.participant_count ?? '—'}/{competition.max_participants}
          </Text>
          <Text style={styles.statLabel}>Players</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.stat}>
          <Text style={styles.statValue}>
            {competition.status === 'completed' ? 'Done' : `${daysLeft}d`}
          </Text>
          <Text style={styles.statLabel}>
            {competition.status === 'completed' ? 'Status' : 'Left'}
          </Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.stat}>
          <Text style={styles.statValue}>
            {formatCents(competition.entry_fee_cents)}
          </Text>
          <Text style={styles.statLabel}>Entry</Text>
        </View>
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
    ...Shadow.md,
  },
  cardCompact: {
    padding: Spacing.md,
    width: 280,
    marginRight: Spacing.md,
    marginBottom: 0,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
  },
  typeEmoji: {
    fontSize: FontSize.sm,
    marginRight: Spacing.xs,
  },
  typeLabel: {
    fontSize: FontSize.xs,
    fontWeight: '600',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: Spacing.xs,
  },
  statusText: {
    fontSize: FontSize.xs,
    fontWeight: '600',
  },
  name: {
    fontSize: FontSize.lg,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: Spacing.xs,
  },
  description: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginBottom: Spacing.md,
    lineHeight: 18,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
  stat: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  statLabel: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 28,
    backgroundColor: Colors.borderLight,
  },
});
