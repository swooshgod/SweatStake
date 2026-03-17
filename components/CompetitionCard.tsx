import React, { useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableWithoutFeedback, Animated } from 'react-native';
import { useRouter } from 'expo-router';
import { Spacing, BorderRadius, FontSize, CompetitionTypes } from '@/constants/theme';
import { useTheme } from '@/contexts/ThemeContext';
import { formatCents } from '@/lib/stripe';
import { competitionPrizeInCredits } from '@/lib/prizes';
import { FITNESS_TIERS, getTierIndex } from '@/lib/healthkit';
import type { Competition, ScoringMode, FitnessTier } from '@/lib/types';

interface Props {
  competition: Competition;
  variant?: 'full' | 'compact';
  viewerTier?: FitnessTier | null;
  index?: number;
}

const SCORING_MODE_BADGES: Partial<Record<ScoringMode, { emoji: string; label: string; color: string }>> = {
  relative_improvement: { emoji: '📈', label: '% Improvement', color: '#3B82F6' },
  raw_steps: { emoji: '👟', label: 'Most Steps', color: '#8B5CF6' },
  raw_miles: { emoji: '🏃', label: 'Most Miles', color: '#EC4899' },
  raw_calories: { emoji: '🔥', label: 'Most Calories', color: '#F59E0B' },
  raw_workouts: { emoji: '💪', label: 'Most Workouts', color: '#10B981' },
  raw_active_minutes: { emoji: '⏱️', label: 'Active Minutes', color: '#6366F1' },
  raw_weight_loss_pct: { emoji: '⚖️', label: 'Weight Loss %', color: '#EC4899' },
};

export default function CompetitionCard({ competition, variant = 'full', viewerTier, index = 0 }: Props) {
  const router = useRouter();
  const { Colors, Shadow } = useTheme();
  const typeInfo = CompetitionTypes[competition.type] ?? CompetitionTypes.custom;
  const hasFee = competition.entry_fee_cents > 0;

  // --- Animations ---
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(24)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const shimmerAnim = useRef(new Animated.Value(0)).current;

  // Staggered fade-in + slide-up on mount
  useEffect(() => {
    const delay = index * 80;
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        delay,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 400,
        delay,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  // Shimmer loop for paid competitions
  useEffect(() => {
    if (!hasFee) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerAnim, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: true,
        }),
        Animated.timing(shimmerAnim, {
          toValue: 0,
          duration: 2000,
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [hasFee]);

  const onPressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.97,
      useNativeDriver: true,
    }).start();
  };

  const onPressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      friction: 3,
      useNativeDriver: true,
    }).start();
  };

  const daysLeft = Math.max(
    0,
    Math.ceil((new Date(competition.end_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
  );

  const participantCount = competition.participant_count ?? 0;
  const timeLabel = competition.status === 'completed' ? 'Done' : `${daysLeft}d left`;

  // Tier mismatch warnings
  const creatorTier = competition.creator_tier;
  const tierInfo = creatorTier ? FITNESS_TIERS[creatorTier] : null;
  const tierLock = competition.tier_lock ?? 'none';

  let tierWarning: 'above' | 'below' | null = null;
  if (viewerTier && creatorTier) {
    const diff = getTierIndex(viewerTier) - getTierIndex(creatorTier);
    if (diff >= 2) tierWarning = 'above';
    else if (diff <= -2) tierWarning = 'below';
  }

  // Shimmer opacity interpolation for prize amount
  const prizeOpacity = shimmerAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [1, 0.7, 1],
  });

  const dynamicStyles = {
    card: {
      backgroundColor: Colors.surface,
      borderColor: Colors.border,
      borderLeftColor: Colors.primary,
      ...Shadow.md,
    },
    cardPaid: {
      borderColor: Colors.primary + '40',
    },
    name: {
      color: Colors.textPrimary,
    },
    meta: {
      color: Colors.textSecondary,
    },
    potLabel: {
      color: Colors.textMuted,
    },
    badge: {
      backgroundColor: Colors.primaryGlow,
    },
    badgeText: {
      color: Colors.primary,
    },
  };

  return (
    <TouchableWithoutFeedback
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      onPress={() => router.push(`/competition/${competition.id}`)}
    >
      <Animated.View
        style={[
          styles.card,
          dynamicStyles.card,
          variant === 'compact' && styles.cardCompact,
          hasFee && dynamicStyles.cardPaid,
          tierWarning === 'below' && styles.cardWarning,
          {
            opacity: fadeAnim,
            transform: [
              { translateY: slideAnim },
              { scale: scaleAnim },
            ],
          },
        ]}
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
              <Text style={[styles.name, dynamicStyles.name]} numberOfLines={1}>{competition.name}</Text>
            </View>
            <Text style={[styles.meta, dynamicStyles.meta]}>
              {participantCount} joined · {timeLabel}
            </Text>
          </View>
          <View style={styles.potContainer}>
            <Animated.Text
              style={[
                styles.potAmount,
                { color: hasFee ? Colors.accentGold : Colors.success },
                !hasFee && [styles.potFree, { color: Colors.success }],
                hasFee && { opacity: prizeOpacity },
              ]}
            >
              {!hasFee ? 'Free' : `$${(competition.prize_pool_cents * 0.9 / 100).toFixed(0)}`}
            </Animated.Text>
            {hasFee && <Text style={[styles.potLabel, dynamicStyles.potLabel]}>prize</Text>}
          </View>
        </View>

        {/* Entry fee */}
        {hasFee && (
          <View style={[styles.feeRow]}>
            <View style={[styles.badge, dynamicStyles.badge]}>
              <Text style={[styles.badgeText, dynamicStyles.badgeText]}>
                {formatCents(competition.entry_fee_cents)} entry
              </Text>
            </View>
          </View>
        )}
      </Animated.View>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderLeftWidth: 3,
    overflow: 'hidden',
  },
  cardCompact: {
    padding: Spacing.md,
    width: 280,
    marginRight: Spacing.md,
    marginBottom: 0,
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
    fontWeight: '800',
    flex: 1,
  },
  meta: {
    fontSize: FontSize.sm,
    marginLeft: 26,
  },
  potContainer: {
    alignItems: 'flex-end',
  },
  potAmount: {
    fontSize: FontSize.xxl,
    fontWeight: '900',
  },
  potFree: {
    fontSize: FontSize.lg,
  },
  potLabel: {
    fontSize: FontSize.xs,
    fontWeight: '600',
    marginTop: -2,
  },
  feeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  badge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
  },
  badgeText: {
    fontSize: FontSize.xs,
    fontWeight: '700',
  },
});
