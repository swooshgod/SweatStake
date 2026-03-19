import React, { useState } from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Spacing, BorderRadius, FontSize, Colors } from '@/constants/theme';
import { useTheme } from '@/contexts/ThemeContext';
import { getTrustBadge } from '@/lib/trust';
import ReportUserModal from '@/components/ReportUserModal';
import type { Participant } from '@/lib/types';

interface Props {
  participant: Participant;
  isCurrentUser?: boolean;
  currentUserId?: string;
  competitionId?: string;
}

const RANK_MEDALS: Record<number, string> = {
  1: '🥇',
  2: '🥈',
  3: '🥉',
};

export default function LeaderboardRow({
  participant,
  isCurrentUser,
  currentUserId,
  competitionId,
}: Props) {
  const { Colors } = useTheme();
  const rank = participant.rank ?? 0;
  const medal = RANK_MEDALS[rank];
  const profile = participant.profile;
  const [reportModalVisible, setReportModalVisible] = useState(false);

  // Trust badge
  const trustScore = profile?.trust_score ?? 50;
  const trustBadge = getTrustBadge(trustScore);
  const isDisqualified = participant.disqualified;

  return (
    <>
      <View style={[
        styles.row,
        { borderBottomColor: Colors.borderLight },
        isCurrentUser && { backgroundColor: Colors.primary + '08', borderLeftWidth: 3, borderLeftColor: Colors.primary },
        isDisqualified && { opacity: 0.5, backgroundColor: Colors.error + '05' },
      ]}>
        {/* Rank */}
        <View style={styles.rankContainer}>
          {isDisqualified ? (
            <Text style={styles.disqualifiedIcon}>🚫</Text>
          ) : medal ? (
            <Text style={[styles.medal, rank === 1 && { textShadow: `0px 0px 8px ${Colors.accentGold}` }]}>{medal}</Text>
          ) : (
            <Text style={[styles.rankNumber, { color: Colors.textMuted }]}>{rank}</Text>
          )}
        </View>

        {/* Avatar */}
        <View style={styles.avatarContainer}>
          {profile?.avatar_url ? (
            <Image source={{ uri: profile.avatar_url }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarPlaceholder, { backgroundColor: Colors.primary + '20' }]}>
              <Text style={[styles.avatarInitial, { color: Colors.primary }]}>
                {(profile?.display_name ?? '?')[0].toUpperCase()}
              </Text>
            </View>
          )}
        </View>

        {/* Name + streak + trust */}
        <View style={styles.nameContainer}>
          <View style={styles.nameRow}>
            <Text style={[styles.name, { color: Colors.textPrimary }, rank === 1 && !isDisqualified && { color: Colors.accentGold }, isDisqualified && { textDecorationLine: 'line-through', color: Colors.textMuted }]} numberOfLines={1}>
              {profile?.display_name ?? 'Unknown'}
              {isCurrentUser && <Text style={[styles.youBadge, { color: Colors.primary }]}> (You)</Text>}
            </Text>
            {/* Trust badge */}
            <View style={[styles.trustBadge, { backgroundColor: trustBadge.bgColor }]}>
              <Text style={styles.trustEmoji}>{trustBadge.emoji}</Text>
            </View>
          </View>
          {participant.current_streak > 0 && !isDisqualified && (
            <Text style={[styles.streak, { color: Colors.textSecondary }]}>
              🔥 {participant.current_streak} day streak
            </Text>
          )}
          {isDisqualified && (
            <Text style={[styles.disqualifiedText, { color: Colors.error }]}>Disqualified</Text>
          )}
        </View>

        {/* Points + report button */}
        <View style={styles.rightSection}>
          <View style={styles.pointsContainer}>
            <Text style={[
              styles.points,
              { color: Colors.textPrimary },
              rank === 1 && !isDisqualified && { color: Colors.accentGold },
              isDisqualified && { color: Colors.textMuted, fontSize: FontSize.md },
            ]}>
              {isDisqualified ? '—' : participant.total_points}
            </Text>
            {!isDisqualified && <Text style={[styles.pointsLabel, { color: Colors.textMuted }]}>pts</Text>}
          </View>

          {/* Report button — only show for other users */}
          {!isCurrentUser && currentUserId && competitionId && !isDisqualified && (
            <TouchableOpacity
              style={styles.reportBtn}
              onPress={() => setReportModalVisible(true)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="flag-outline" size={14} color={Colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Report modal */}
      {currentUserId && competitionId && (
        <ReportUserModal
          visible={reportModalVisible}
          onClose={() => setReportModalVisible(false)}
          reportedUserId={participant.user_id}
          reportedDisplayName={profile?.display_name ?? 'this competitor'}
          competitionId={competitionId}
          currentUserId={currentUserId}
        />
      )}
    </>
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
  rowDisqualified: {
    opacity: 0.5,
    backgroundColor: Colors.error + '05',
  },
  rankContainer: {
    width: 36,
    alignItems: 'center',
  },
  medal: {
    fontSize: FontSize.xl,
  },
  disqualifiedIcon: {
    fontSize: FontSize.lg,
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
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  name: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.textPrimary,
    flexShrink: 1,
  },
  nameDisqualified: {
    textDecorationLine: 'line-through',
    color: Colors.textMuted,
  },
  youBadge: {
    fontWeight: '400',
    color: Colors.primary,
    fontSize: FontSize.sm,
  },
  trustBadge: {
    borderRadius: BorderRadius.full,
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  trustEmoji: {
    fontSize: 10,
  },
  streak: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  disqualifiedText: {
    fontSize: FontSize.xs,
    color: Colors.error,
    fontWeight: '600',
    marginTop: 2,
  },
  rightSection: {
    alignItems: 'flex-end',
    gap: 4,
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
  pointsDisqualified: {
    color: Colors.textMuted,
    fontSize: FontSize.md,
  },
  pointsLabel: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
  },
  reportBtn: {
    padding: 2,
  },
});
