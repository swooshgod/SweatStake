import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, BorderRadius, FontSize, Shadow, CompetitionTypes } from '@/constants/theme';
import { formatCents } from '@/lib/stripe';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import type { Competition } from '@/lib/types';

export default function JoinScreen() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const router = useRouter();
  const { profile, isAuthenticated } = useAuth();
  const [competition, setCompetition] = useState<Competition | null>(null);
  const [participantCount, setParticipantCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [alreadyJoined, setAlreadyJoined] = useState(false);

  useEffect(() => {
    fetchCompetition();
  }, [code]);

  async function fetchCompetition() {
    setLoading(true);
    const { data: comp } = await supabase
      .from('competitions')
      .select('*')
      .eq('invite_code', code)
      .single();

    if (comp) {
      setCompetition(comp as Competition);

      const { count } = await supabase
        .from('participants')
        .select('*', { count: 'exact', head: true })
        .eq('competition_id', comp.id);

      setParticipantCount(count ?? 0);

      // Check if already joined
      if (profile) {
        const { data: existing } = await supabase
          .from('participants')
          .select('id')
          .eq('competition_id', comp.id)
          .eq('user_id', profile.id)
          .single();

        if (existing) setAlreadyJoined(true);
      }
    }
    setLoading(false);
  }

  const handleJoin = async () => {
    if (!isAuthenticated) {
      router.push('/(auth)/welcome');
      return;
    }

    if (!profile || !competition) return;

    setJoining(true);
    try {
      const { error } = await supabase.from('participants').insert({
        competition_id: competition.id,
        user_id: profile.id,
        paid: competition.entry_fee_cents === 0,
      });

      if (error) throw error;

      Alert.alert('Welcome!', `You've joined "${competition.name}"!`, [
        { text: 'Let\'s go!', onPress: () => router.replace(`/competition/${competition.id}`) },
      ]);
    } catch (error) {
      Alert.alert('Error', 'Failed to join. You may already be a participant.');
    } finally {
      setJoining(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Finding competition...</Text>
      </View>
    );
  }

  if (!competition) {
    return (
      <View style={styles.centered}>
        <Ionicons name="alert-circle-outline" size={64} color={Colors.textMuted} />
        <Text style={styles.errorTitle}>Competition Not Found</Text>
        <Text style={styles.errorSubtitle}>
          The invite code "{code}" doesn't match any competition.
        </Text>
        <TouchableOpacity style={styles.backHomeBtn} onPress={() => router.replace('/(tabs)')}>
          <Text style={styles.backHomeBtnText}>Go Home</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const typeInfo = CompetitionTypes[competition.type] ?? CompetitionTypes.custom;
  const isFull = participantCount >= competition.max_participants;

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        {/* Invite badge */}
        <View style={styles.inviteBadge}>
          <Ionicons name="mail-open" size={20} color={Colors.primary} />
          <Text style={styles.inviteBadgeText}>You've been invited!</Text>
        </View>

        {/* Competition info */}
        <View style={[styles.typeBadge, { backgroundColor: typeInfo.color + '18' }]}>
          <Text>{typeInfo.emoji}</Text>
          <Text style={[styles.typeLabel, { color: typeInfo.color }]}>{typeInfo.label}</Text>
        </View>

        <Text style={styles.competitionName}>{competition.name}</Text>
        {competition.description && (
          <Text style={styles.description}>{competition.description}</Text>
        )}

        {/* Details */}
        <View style={styles.detailsGrid}>
          <View style={styles.detailItem}>
            <Ionicons name="calendar" size={18} color={Colors.textMuted} />
            <Text style={styles.detailText}>
              {new Date(competition.start_date).toLocaleDateString()} — {new Date(competition.end_date).toLocaleDateString()}
            </Text>
          </View>
          <View style={styles.detailItem}>
            <Ionicons name="people" size={18} color={Colors.textMuted} />
            <Text style={styles.detailText}>
              {participantCount}/{competition.max_participants} players
            </Text>
          </View>
          <View style={styles.detailItem}>
            <Ionicons name="cash" size={18} color={Colors.textMuted} />
            <Text style={styles.detailText}>
              Entry: {formatCents(competition.entry_fee_cents)}
            </Text>
          </View>
          <View style={styles.detailItem}>
            <Ionicons name="trophy" size={18} color={Colors.accent} />
            <Text style={[styles.detailText, { color: Colors.accent, fontWeight: '700' }]}>
              Prize Pool: {formatCents(competition.prize_pool_cents)}
            </Text>
          </View>
        </View>

        {/* Join button */}
        {alreadyJoined ? (
          <TouchableOpacity
            style={[styles.joinButton, { backgroundColor: Colors.success }]}
            onPress={() => router.replace(`/competition/${competition.id}`)}
          >
            <Ionicons name="checkmark-circle" size={20} color="#fff" />
            <Text style={styles.joinButtonText}>Already Joined — View Competition</Text>
          </TouchableOpacity>
        ) : isFull ? (
          <View style={[styles.joinButton, { backgroundColor: Colors.textMuted }]}>
            <Ionicons name="close-circle" size={20} color="#fff" />
            <Text style={styles.joinButtonText}>Competition Full</Text>
          </View>
        ) : (
          <TouchableOpacity
            style={styles.joinButton}
            onPress={handleJoin}
            disabled={joining}
          >
            <Ionicons name="flash" size={20} color="#fff" />
            <Text style={styles.joinButtonText}>
              {joining
                ? 'Joining...'
                : competition.entry_fee_cents > 0
                  ? `Join — ${formatCents(competition.entry_fee_cents)}`
                  : 'Join Competition — Free'}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    padding: Spacing.xxl,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
    padding: Spacing.xxl,
  },
  loadingText: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
    marginTop: Spacing.lg,
  },
  errorTitle: {
    fontSize: FontSize.xl,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginTop: Spacing.lg,
  },
  errorSubtitle: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
    marginTop: Spacing.sm,
    textAlign: 'center',
  },
  backHomeBtn: {
    marginTop: Spacing.xxl,
    paddingHorizontal: Spacing.xxl,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.lg,
  },
  backHomeBtnText: {
    color: '#fff',
    fontSize: FontSize.md,
    fontWeight: '700',
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.xxl,
    ...Shadow.lg,
  },
  inviteBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    alignSelf: 'center',
    marginBottom: Spacing.xxl,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.primary + '10',
    borderRadius: BorderRadius.full,
  },
  inviteBadgeText: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    color: Colors.primary,
  },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
    marginBottom: Spacing.md,
  },
  typeLabel: {
    fontSize: FontSize.xs,
    fontWeight: '600',
  },
  competitionName: {
    fontSize: FontSize.xxl,
    fontWeight: '800',
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
  },
  description: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
    lineHeight: 22,
    marginBottom: Spacing.lg,
  },
  detailsGrid: {
    gap: Spacing.md,
    marginBottom: Spacing.xxl,
    paddingTop: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  detailText: {
    fontSize: FontSize.md,
    color: Colors.textPrimary,
  },
  joinButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.primary,
    paddingVertical: Spacing.lg,
    borderRadius: BorderRadius.lg,
    ...Shadow.md,
  },
  joinButtonText: {
    color: '#fff',
    fontSize: FontSize.md,
    fontWeight: '700',
  },
});
