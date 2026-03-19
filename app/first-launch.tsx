/**
 * Podium — First Launch Experience
 *
 * Shown ONCE on first app open. Skips straight to the most compelling
 * live competition to create immediate FOMO and drive first join.
 *
 * Funnel: See prize → See countdown → Tap Join → Apple Pay → In the game
 */

'use client';
import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  TouchableOpacity,
  StatusBar,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/lib/supabase';
import { Colors, Spacing, BorderRadius, FontSize, Shadow } from '@/constants/theme';
import type { Competition } from '@/lib/types';

const FIRST_LAUNCH_KEY = 'podium_first_launch_seen';

// ---------------------------------------------------------------------------
// Countdown helper
// ---------------------------------------------------------------------------

function useCountdown(endDate: string) {
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });

  useEffect(() => {
    const calc = () => {
      const diff = new Date(endDate).getTime() - Date.now();
      if (diff <= 0) return;
      setTimeLeft({
        days:    Math.floor(diff / (1000 * 60 * 60 * 24)),
        hours:   Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
        minutes: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
        seconds: Math.floor((diff % (1000 * 60)) / 1000),
      });
    };
    calc();
    const t = setInterval(calc, 1000);
    return () => clearInterval(t);
  }, [endDate]);

  return timeLeft;
}

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------

export default function FirstLaunchScreen() {
  const router = useRouter();
  const [competition, setCompetition] = useState<Competition | null>(null);
  const [participantCount, setParticipantCount] = useState(0);

  // Animations
  const logoOpacity  = useRef(new Animated.Value(0)).current;
  const heroOpacity  = useRef(new Animated.Value(0)).current;
  const heroY        = useRef(new Animated.Value(30)).current;
  const cardOpacity  = useRef(new Animated.Value(0)).current;
  const cardY        = useRef(new Animated.Value(40)).current;
  const btnOpacity   = useRef(new Animated.Value(0)).current;
  const btnScale     = useRef(new Animated.Value(0.9)).current;
  const pulseAnim    = useRef(new Animated.Value(1)).current;

  const timeLeft = useCountdown(competition?.end_date ?? new Date(Date.now() + 7 * 86400000).toISOString());

  useEffect(() => {
    fetchFeaturedCompetition();
    startAnimations();
    startPulse();
  }, []);

  const fetchFeaturedCompetition = async () => {
    // Get the most compelling open competition: highest prize pool, most participants
    const { data } = await supabase
      .from('competitions')
      .select('*, participants(count)')
      .eq('status', 'open')
      .eq('is_public', true)
      .gt('entry_fee_cents', 0)
      .order('prize_pool_cents', { ascending: false })
      .limit(1)
      .single();

    if (data) {
      setCompetition(data as Competition);
      setParticipantCount(data.participant_count ?? 0);
    }
  };

  const startAnimations = () => {
    Animated.sequence([
      Animated.timing(logoOpacity, { toValue: 1, duration: 600, useNativeDriver: Platform.OS !== 'web' }),
      Animated.parallel([
        Animated.timing(heroOpacity, { toValue: 1, duration: 500, useNativeDriver: Platform.OS !== 'web' }),
        Animated.timing(heroY, { toValue: 0, duration: 500, useNativeDriver: Platform.OS !== 'web' }),
      ]),
      Animated.parallel([
        Animated.timing(cardOpacity, { toValue: 1, duration: 500, useNativeDriver: Platform.OS !== 'web' }),
        Animated.timing(cardY, { toValue: 0, duration: 500, useNativeDriver: Platform.OS !== 'web' }),
      ]),
      Animated.parallel([
        Animated.timing(btnOpacity, { toValue: 1, duration: 400, useNativeDriver: Platform.OS !== 'web' }),
        Animated.spring(btnScale, { toValue: 1, friction: 6, useNativeDriver: Platform.OS !== 'web' }),
      ]),
    ]).start();
  };

  const startPulse = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.06, duration: 900, useNativeDriver: Platform.OS !== 'web' }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 900, useNativeDriver: Platform.OS !== 'web' }),
      ])
    ).start();
  };

  const handleJoin = async () => {
    await AsyncStorage.setItem(FIRST_LAUNCH_KEY, 'true');
    if (competition) {
      router.replace(`/join/${competition.invite_code}`);
    } else {
      router.replace('/(tabs)');
    }
  };

  const handleSkip = async () => {
    await AsyncStorage.setItem(FIRST_LAUNCH_KEY, 'true');
    router.replace('/(tabs)');
  };

  const prizeDollars = competition
    ? Math.floor((competition.prize_pool_cents * 0.9) / 100)
    : 0;

  const spotsLeft = competition
    ? competition.max_participants - participantCount
    : 0;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Background gradient */}
      <LinearGradient
        colors={['#0A0A0A', '#1A0A00', '#0A0A0A']}
        style={[StyleSheet.absoluteFill, { zIndex: 0, pointerEvents: 'none' } as any]}
      />

      {/* Orange glow */}
      <Animated.View style={[styles.glow, { opacity: cardOpacity, zIndex: 0, pointerEvents: 'none' } as any]} />

      {/* Top: PODIUM wordmark */}
      <Animated.View style={[styles.wordmarkContainer, { opacity: logoOpacity }]}>
        <Text style={styles.wordmark}>PODIUM</Text>
      </Animated.View>

      {/* Hero text */}
      <Animated.View style={[styles.heroContainer, { opacity: heroOpacity, transform: [{ translateY: heroY }] }]}>
        <Text style={styles.heroLine1}>Real money.</Text>
        <Text style={styles.heroLine2}>Real competition.</Text>
        <Text style={styles.heroSub}>Verified by Apple Health.</Text>
      </Animated.View>

      {/* Featured competition card */}
      {competition && (
        <Animated.View style={[styles.card, { opacity: cardOpacity, transform: [{ translateY: cardY }] }]}>
          {/* Live badge */}
          <View style={styles.liveBadge}>
            <Animated.View style={[styles.liveDot, { transform: [{ scale: pulseAnim }] }]} />
            <Text style={styles.liveText}>LIVE NOW</Text>
          </View>

          <Text style={styles.competitionName}>{competition.name}</Text>

          {/* Prize */}
          <View style={styles.prizeRow}>
            <Text style={styles.prizeLabel}>Prize Pool</Text>
            <Text style={styles.prizeAmount}>${prizeDollars}</Text>
          </View>

          {/* Stats */}
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{participantCount}</Text>
              <Text style={styles.statLabel}>Competing</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={[styles.statValue, spotsLeft <= 3 && { color: Colors.error }]}>
                {spotsLeft}
              </Text>
              <Text style={styles.statLabel}>Spots Left</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{timeLeft.days}d {timeLeft.hours}h</Text>
              <Text style={styles.statLabel}>Remaining</Text>
            </View>
          </View>

          {/* Countdown */}
          <View style={styles.countdown}>
            {[
              { value: String(timeLeft.days).padStart(2, '0'), label: 'DAYS' },
              { value: String(timeLeft.hours).padStart(2, '0'), label: 'HRS' },
              { value: String(timeLeft.minutes).padStart(2, '0'), label: 'MIN' },
              { value: String(timeLeft.seconds).padStart(2, '0'), label: 'SEC' },
            ].map((t, i) => (
              <React.Fragment key={t.label}>
                {i > 0 && <Text style={styles.countdownColon}>:</Text>}
                <View style={styles.countdownBlock}>
                  <Text style={styles.countdownValue}>{t.value}</Text>
                  <Text style={styles.countdownLabel}>{t.label}</Text>
                </View>
              </React.Fragment>
            ))}
          </View>

          {/* Entry fee */}
          <Text style={styles.entryFee}>
            ${(competition.entry_fee_cents / 100).toFixed(0)} entry · 90% goes to winner
          </Text>
        </Animated.View>
      )}

      {/* CTA Buttons */}
      <Animated.View style={[styles.ctaContainer, { opacity: btnOpacity, transform: [{ scale: btnScale }] }]}>
        <TouchableOpacity
          style={styles.joinButton}
          onPress={handleJoin}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel={competition ? `Join competition for $${(competition.entry_fee_cents / 100).toFixed(0)}` : 'Start competing'}
        >
          <Ionicons name="flash" size={20} color="#000" />
          <Text style={styles.joinButtonText}>
            {competition ? `Join for $${(competition.entry_fee_cents / 100).toFixed(0)}` : 'Start Competing'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.skipButton}
          onPress={handleSkip}
          accessibilityRole="button"
          accessibilityLabel="Skip and browse competitions"
        >
          <Text style={styles.skipText}>Just browsing →</Text>
        </TouchableOpacity>
      </Animated.View>

      {/* Bottom note */}
      <Animated.Text style={[styles.legalNote, { opacity: btnOpacity }]}>
        Skill-based competition · 18+ · Not available in all regions
      </Animated.Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0A',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
    overflow: 'hidden',
  },
  glow: {
    position: 'absolute',
    top: '30%',
    left: '10%',
    width: '80%',
    maxWidth: 500,
    height: 300,
    backgroundColor: 'transparent',
    borderRadius: 300,
    overflow: 'hidden',
    alignSelf: 'center',
    ...(Platform.OS === 'web'
      ? { boxShadow: '0 0 120px 80px rgba(255, 90, 31, 0.07)' }
      : { backgroundColor: Colors.primary, opacity: 0.07, ...Shadow.lg }),
  },
  wordmarkContainer: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 60 : 40,
    zIndex: 1,
  },
  wordmark: {
    fontSize: 16,
    fontWeight: '900',
    color: '#22C55E',
    letterSpacing: 8,
  },
  heroContainer: {
    alignItems: 'center',
    marginBottom: Spacing.xxl,
    marginTop: -60,
    zIndex: 1,
  },
  heroLine1: {
    fontSize: FontSize.xxxl,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: -1,
    lineHeight: 40,
  },
  heroLine2: {
    fontSize: FontSize.xxxl,
    fontWeight: '900',
    color: '#22C55E',
    letterSpacing: -1,
    lineHeight: 40,
    marginBottom: Spacing.md,
  },
  heroSub: {
    fontSize: FontSize.sm,
    color: '#666',
    fontWeight: '500',
  },
  card: {
    width: '100%',
    maxWidth: 480,
    backgroundColor: '#141414',
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    borderWidth: 1,
    borderColor: Colors.primary + '30',
    marginBottom: Spacing.xl,
    zIndex: 1,
    ...Shadow.gold,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    backgroundColor: '#22C55E18',
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: 4,
    marginBottom: Spacing.md,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#22C55E',
  },
  liveText: {
    fontSize: FontSize.xs,
    fontWeight: '800',
    color: '#22C55E',
    letterSpacing: 1,
  },
  competitionName: {
    fontSize: FontSize.xl,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: Spacing.lg,
  },
  prizeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.lg,
    backgroundColor: Colors.primary + '10',
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.primary + '25',
  },
  prizeLabel: {
    fontSize: FontSize.sm,
    color: '#888',
    fontWeight: '600',
  },
  prizeAmount: {
    fontSize: FontSize.xxxl,
    fontWeight: '900',
    color: '#22C55E',
  },
  statsRow: {
    flexDirection: 'row',
    backgroundColor: '#0A0A0A',
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.md,
    marginBottom: Spacing.lg,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: FontSize.lg,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  statLabel: {
    fontSize: FontSize.xs,
    color: '#555',
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    backgroundColor: '#222',
  },
  countdown: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
    marginBottom: Spacing.lg,
  },
  countdownBlock: {
    alignItems: 'center',
    backgroundColor: '#0A0A0A',
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    minWidth: 52,
  },
  countdownValue: {
    fontSize: FontSize.xxl,
    fontWeight: '900',
    color: '#FFFFFF',
    fontVariant: ['tabular-nums'],
  },
  countdownLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: '#444',
    letterSpacing: 1,
    marginTop: 1,
  },
  countdownColon: {
    fontSize: FontSize.xl,
    fontWeight: '900',
    color: '#333',
    marginBottom: 12,
  },
  entryFee: {
    fontSize: FontSize.xs,
    color: '#555',
    textAlign: 'center',
    fontWeight: '500',
  },
  ctaContainer: {
    width: '100%',
    maxWidth: 480,
    gap: Spacing.md,
    zIndex: 1,
  },
  joinButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.primary,
    paddingVertical: Spacing.lg + 2,
    borderRadius: BorderRadius.lg,
    ...Shadow.gold,
  },
  joinButtonText: {
    color: '#000',
    fontSize: FontSize.lg,
    fontWeight: '900',
  },
  skipButton: {
    alignItems: 'center',
    paddingVertical: Spacing.md,
  },
  skipText: {
    fontSize: FontSize.sm,
    color: '#444',
    fontWeight: '500',
  },
  legalNote: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 40 : 24,
    fontSize: 10,
    color: '#333',
    textAlign: 'center',
  },
});
