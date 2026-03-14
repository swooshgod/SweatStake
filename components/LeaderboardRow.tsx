import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { Colors, Spacing, BorderRadius, FontSize } from '@/constants/theme';
import type { Participant } from '@/lib/types';

interface Props {
  participant: Participant;
  isCurrentUser?: boolean;
}

const RANK_MEDALS: Record<number, string> = {
  1: '🥇',
  2: '🥈',
  3: '🥉',
};

export default function LeaderboardRow({ participant, isCurrentUser }: Props) {
  const rank = participant.rank ?? 0;
  const medal = RANK_MEDALS[rank];
  const profile = participant.profile;

  return (
    <View style={[styles.row, isCurrentUser && styles.rowHighlighted]}>
      {/* Rank */}
      <View style={styles.rankContainer}>
        {medal ? (
          <Text style={styles.medal}>{medal}</Text>
        ) : (
          <Text style={styles.rankNumber}>{rank}</Text>
        )}
      </View>

      {/* Avatar */}
      <View style={styles.avatarContainer}>
        {profile?.avatar_url ? (
          <Image source={{ uri: profile.avatar_url }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarPlaceholder]}>
            <Text style={styles.avatarInitial}>
              {(profile?.display_name ?? '?')[0].toUpperCase()}
            </Text>
          </View>
        )}
      </View>

      {/* Name + streak */}
      <View style={styles.nameContainer}>
        <Text style={styles.name} numberOfLines={1}>
          {profile?.display_name ?? 'Unknown'}
          {isCurrentUser && <Text style={styles.youBadge}> (You)</Text>}
        </Text>
        {participant.current_streak > 0 && (
          <Text style={styles.streak}>
            🔥 {participant.current_streak} day streak
          </Text>
        )}
      </View>

      {/* Points */}
      <View style={styles.pointsContainer}>
        <Text style={[styles.points, rank === 1 && styles.pointsGold]}>
          {participant.total_points}
        </Text>
        <Text style={styles.pointsLabel}>pts</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  rowHighlighted: {
    backgroundColor: Colors.primary + '08',
    borderLeftWidth: 3,
    borderLeftColor: Colors.primary,
  },
  rankContainer: {
    width: 36,
    alignItems: 'center',
  },
  medal: {
    fontSize: FontSize.xl,
  },
  rankNumber: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.textMuted,
  },
  avatarContainer: {
    marginRight: Spacing.md,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  avatarPlaceholder: {
    backgroundColor: Colors.primary + '20',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitial: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.primary,
  },
  nameContainer: {
    flex: 1,
  },
  name: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  youBadge: {
    fontWeight: '400',
    color: Colors.primary,
    fontSize: FontSize.sm,
  },
  streak: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  pointsContainer: {
    alignItems: 'flex-end',
    minWidth: 50,
  },
  points: {
    fontSize: FontSize.lg,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  pointsGold: {
    color: Colors.accent,
  },
  pointsLabel: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
  },
});
