import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Spacing, BorderRadius, FontSize, Shadow, Gradients } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { isHealthKitAvailable, requestHealthKitPermissions } from '@/lib/healthkit';
import { formatCents } from '@/lib/stripe';
import { getCreditsBalance, getCreditsDisplay } from '@/lib/prizes';

export default function ProfileScreen() {
  const router = useRouter();
  const { profile, isAuthenticated, signOut } = useAuth();
  const [creditsBalance, setCreditsBalance] = useState<number>(0);

  useEffect(() => {
    if (profile?.id) {
      getCreditsBalance(profile.id).then(setCreditsBalance);
    }
  }, [profile?.id]);

  if (!isAuthenticated || !profile) {
    return (
      <View style={styles.centered}>
        <View style={styles.signInIconWrap}>
          <Ionicons name="person-circle-outline" size={72} color={Colors.primary} />
        </View>
        <Text style={styles.signInTitle}>Join the Competition</Text>
        <Text style={styles.signInSub}>Sign in to track your wins, earnings, and stats.</Text>
        <TouchableOpacity
          style={styles.signInButton}
          onPress={() => router.push('/(auth)/welcome')}
          activeOpacity={0.85}
        >
          <Text style={styles.signInButtonText}>Sign In</Text>
          <Ionicons name="arrow-forward" size={18} color="#000" />
        </TouchableOpacity>
      </View>
    );
  }

  const handleConnectHealth = async () => {
    const granted = await requestHealthKitPermissions();
    if (granted) {
      Alert.alert('Connected ✅', 'Apple Health is now connected. Your workouts and steps will sync automatically.');
    } else {
      Alert.alert('Permission Denied', 'Please enable Health access in Settings > Privacy > Health.');
    }
  };

  const credits = getCreditsDisplay(creditsBalance);
  const winRate = profile.competitions_entered > 0
    ? Math.round((profile.competitions_won / profile.competitions_entered) * 100)
    : 0;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      {/* ─── Profile Header ─── */}
      <View style={styles.profileHeader}>
        {profile.avatar_url ? (
          <Image source={{ uri: profile.avatar_url }} style={styles.avatar} />
        ) : (
          <LinearGradient
            colors={[Colors.primaryLight, Colors.primaryDark]}
            style={[styles.avatar, styles.avatarGradient]}
          >
            <Text style={styles.avatarInitial}>
              {(profile.display_name ?? profile.username ?? 'U')[0].toUpperCase()}
            </Text>
          </LinearGradient>
        )}
        <Text style={styles.displayName}>{profile.display_name ?? profile.username ?? 'Competitor'}</Text>
        {profile.username && (
          <Text style={styles.username}>@{profile.username}</Text>
        )}
      </View>

      {/* ─── Credits Banner ─── */}
      {creditsBalance > 0 && (
        <TouchableOpacity style={styles.creditsBanner} activeOpacity={0.85}>
          <LinearGradient
            colors={[Colors.primaryDark, Colors.primary]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.creditsBannerGradient}
          >
            <View>
              <Text style={styles.creditsLabel}>Podium Credits</Text>
              <Text style={styles.creditsAmount}>{credits.label}</Text>
              <Text style={styles.creditsValue}>{credits.dollarValue} available</Text>
            </View>
            <View style={styles.redeemButton}>
              <Text style={styles.redeemButtonText}>Redeem</Text>
            </View>
          </LinearGradient>
        </TouchableOpacity>
      )}

      {/* ─── Stats Row ─── */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{profile.competitions_entered}</Text>
          <Text style={styles.statLabel}>Competed</Text>
        </View>
        <View style={[styles.statCard, styles.statCardGold]}>
          <Text style={[styles.statValue, { color: Colors.primary }]}>
            {profile.competitions_won}
          </Text>
          <Text style={styles.statLabel}>Won 🏆</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statValue, { color: Colors.success }]}>
            {winRate}%
          </Text>
          <Text style={styles.statLabel}>Win Rate</Text>
        </View>
      </View>

      {/* ─── Total Earnings ─── */}
      {profile.total_winnings > 0 && (
        <View style={styles.earningsCard}>
          <View>
            <Text style={styles.earningsLabel}>Total Earnings</Text>
            <Text style={styles.earningsAmount}>
              {formatCents(profile.total_winnings * 100)}
            </Text>
          </View>
          <Ionicons name="trophy" size={32} color={Colors.primary} />
        </View>
      )}

      {/* ─── Connected Apps ─── */}
      <View style={styles.menuSection}>
        <Text style={styles.menuSectionTitle}>Connected Apps</Text>
        {isHealthKitAvailable() && (
          <TouchableOpacity style={styles.menuItem} onPress={handleConnectHealth} activeOpacity={0.7}>
            <View style={[styles.menuIconBg, { backgroundColor: '#FF375F18' }]}>
              <Ionicons name="heart" size={20} color="#FF375F" />
            </View>
            <View style={styles.menuItemContent}>
              <Text style={styles.menuItemTitle}>Apple Health</Text>
              <Text style={styles.menuItemSubtitle}>Auto-sync workouts & steps</Text>
            </View>
            <Ionicons name="checkmark-circle" size={20} color={Colors.success} />
          </TouchableOpacity>
        )}
      </View>

      {/* ─── Wallet ─── */}
      <View style={styles.menuSection}>
        <Text style={styles.menuSectionTitle}>Wallet</Text>
        <TouchableOpacity style={styles.menuItem} activeOpacity={0.7}>
          <View style={[styles.menuIconBg, { backgroundColor: '#6772E518' }]}>
            <Ionicons name="card" size={20} color="#6772E5" />
          </View>
          <View style={styles.menuItemContent}>
            <Text style={styles.menuItemTitle}>Payment Methods</Text>
            <Text style={styles.menuItemSubtitle}>Cards, Apple Pay & bank transfers</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.menuItem} activeOpacity={0.7}>
          <View style={[styles.menuIconBg, { backgroundColor: '#2775CA18' }]}>
            <Ionicons name="wallet" size={20} color="#2775CA" />
          </View>
          <View style={styles.menuItemContent}>
            <Text style={styles.menuItemTitle}>USDC Wallet</Text>
            <Text style={styles.menuItemSubtitle}>
              {profile.wallet_address
                ? `${profile.wallet_address.slice(0, 6)}...${profile.wallet_address.slice(-4)}`
                : 'Not connected — tap to add'}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
        </TouchableOpacity>
        {credits.canRedeem && (
          <TouchableOpacity style={[styles.menuItem, styles.menuItemGold]} activeOpacity={0.7}>
            <View style={[styles.menuIconBg, { backgroundColor: Colors.primaryGlow }]}>
              <Ionicons name="gift" size={20} color={Colors.primary} />
            </View>
            <View style={styles.menuItemContent}>
              <Text style={[styles.menuItemTitle, { color: Colors.primary }]}>Redeem Credits</Text>
              <Text style={styles.menuItemSubtitle}>{credits.label} ready to cash out</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={Colors.primary} />
          </TouchableOpacity>
        )}
      </View>

      {/* ─── Settings ─── */}
      <View style={styles.menuSection}>
        <Text style={styles.menuSectionTitle}>Settings</Text>
        <TouchableOpacity style={styles.menuItem} activeOpacity={0.7}>
          <View style={[styles.menuIconBg, { backgroundColor: Colors.textMuted + '18' }]}>
            <Ionicons name="notifications" size={20} color={Colors.textMuted} />
          </View>
          <View style={styles.menuItemContent}>
            <Text style={styles.menuItemTitle}>Notifications</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.menuItem}
          activeOpacity={0.7}
          onPress={() => router.push('/(onboarding)/age-verify')}
        >
          <View style={[styles.menuIconBg, { backgroundColor: '#22C55E18' }]}>
            <Ionicons name="shield-checkmark" size={20} color={Colors.success} />
          </View>
          <View style={styles.menuItemContent}>
            <Text style={styles.menuItemTitle}>Age Verification</Text>
            <Text style={styles.menuItemSubtitle}>Required for paid competitions</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.menuItem} activeOpacity={0.7}>
          <View style={[styles.menuIconBg, { backgroundColor: Colors.textMuted + '18' }]}>
            <Ionicons name="document-text" size={20} color={Colors.textMuted} />
          </View>
          <View style={styles.menuItemContent}>
            <Text style={styles.menuItemTitle}>Terms & Privacy</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
        </TouchableOpacity>
      </View>

      {/* ─── Sign Out ─── */}
      <TouchableOpacity
        style={styles.signOutButton}
        onPress={() => {
          Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Sign Out', style: 'destructive', onPress: signOut },
          ]);
        }}
        activeOpacity={0.7}
      >
        <Ionicons name="log-out-outline" size={18} color={Colors.error} />
        <Text style={styles.signOutText}>Sign Out</Text>
      </TouchableOpacity>

      {/* Version */}
      <Text style={styles.version}>Podium v1.0.0</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    padding: Spacing.lg,
    paddingBottom: 120,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
    padding: Spacing.xxxl,
  },
  signInIconWrap: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: Colors.primaryGlow,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  signInTitle: {
    fontSize: FontSize.xxl,
    fontWeight: '800',
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
  },
  signInSub: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: Spacing.xxxl,
  },
  signInButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.xxxl,
    paddingVertical: Spacing.lg,
    borderRadius: BorderRadius.lg,
    ...Shadow.gold,
  },
  signInButtonText: {
    color: '#000',
    fontSize: FontSize.md,
    fontWeight: '800',
  },
  profileHeader: {
    alignItems: 'center',
    paddingVertical: Spacing.xxl,
  },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    marginBottom: Spacing.md,
  },
  avatarGradient: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitial: {
    fontSize: FontSize.xxxl,
    fontWeight: '900',
    color: '#000',
  },
  displayName: {
    fontSize: FontSize.xxl,
    fontWeight: '800',
    color: Colors.textPrimary,
    letterSpacing: -0.5,
  },
  username: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    marginTop: Spacing.xs,
  },
  creditsBanner: {
    marginBottom: Spacing.xl,
    borderRadius: BorderRadius.xl,
    overflow: 'hidden',
    ...Shadow.gold,
  },
  creditsBannerGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.xl,
  },
  creditsLabel: {
    fontSize: FontSize.xs,
    fontWeight: '700',
    color: 'rgba(0,0,0,0.6)',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  creditsAmount: {
    fontSize: FontSize.xl,
    fontWeight: '900',
    color: '#000',
  },
  creditsValue: {
    fontSize: FontSize.xs,
    color: 'rgba(0,0,0,0.6)',
    marginTop: 2,
  },
  redeemButton: {
    backgroundColor: 'rgba(0,0,0,0.2)',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
  },
  redeemButtonText: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    color: '#000',
  },
  statsRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginBottom: Spacing.xl,
  },
  statCard: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadow.sm,
  },
  statCardGold: {
    borderColor: Colors.borderGold,
    backgroundColor: Colors.primaryGlow,
  },
  statValue: {
    fontSize: FontSize.xxl,
    fontWeight: '900',
    color: Colors.textPrimary,
  },
  statLabel: {
    fontSize: FontSize.xs,
    fontWeight: '600',
    color: Colors.textMuted,
    marginTop: Spacing.xs,
  },
  earningsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.xl,
    marginBottom: Spacing.xl,
    borderWidth: 1,
    borderColor: Colors.borderGold,
    ...Shadow.goldSm,
  },
  earningsLabel: {
    fontSize: FontSize.xs,
    fontWeight: '700',
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  earningsAmount: {
    fontSize: FontSize.xxxl,
    fontWeight: '900',
    color: Colors.primary,
  },
  menuSection: {
    marginBottom: Spacing.xxl,
  },
  menuSectionTitle: {
    fontSize: FontSize.xs,
    fontWeight: '700',
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: Spacing.md,
    paddingLeft: Spacing.xs,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadow.sm,
  },
  menuItemGold: {
    borderColor: Colors.borderGold,
    backgroundColor: Colors.primaryGlow,
  },
  menuIconBg: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  menuItemContent: {
    flex: 1,
  },
  menuItemTitle: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  menuItemSubtitle: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.lg,
    marginTop: Spacing.md,
  },
  signOutText: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.error,
  },
  version: {
    textAlign: 'center',
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    marginTop: Spacing.sm,
  },
});
