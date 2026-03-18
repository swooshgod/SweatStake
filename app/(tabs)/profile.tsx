import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
  Linking,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Spacing, BorderRadius, FontSize, Gradients } from '@/constants/theme';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/hooks/useAuth';
import { isHealthKitAvailable, requestHealthKitPermissions } from '@/lib/healthkit';
import { formatCents } from '@/lib/stripe';
import { getCreditsBalance, getCreditsDisplay } from '@/lib/prizes';
import * as ImagePicker from 'expo-image-picker';
import { getProStatus, type ProStatus } from '@/lib/subscription';
import { supabase } from '@/lib/supabase';

export default function ProfileScreen() {
  const router = useRouter();
  const { Colors, Shadow } = useTheme();
  const { profile, isAuthenticated, signOut } = useAuth();
  const [creditsBalance, setCreditsBalance] = useState<number>(0);
  const [localAvatarUri, setLocalAvatarUri] = useState<string | null>(null);
  const [proStatus, setProStatus] = useState<ProStatus>({ isPro: false, expiresAt: null, daysRemaining: null });

  useEffect(() => {
    if (profile?.id) {
      getCreditsBalance(profile.id).then(setCreditsBalance).catch(() => {});
      getProStatus(profile.id).then(setProStatus).catch(() => {});
    }
  }, [profile?.id]);

  const dynamicStyles = {
    container: {
      backgroundColor: Colors.background,
    },
    centered: {
      backgroundColor: Colors.background,
    },
    signInIconWrap: {
      backgroundColor: Colors.primaryGlow,
    },
    signInTitle: {
      color: Colors.textPrimary,
    },
    signInSub: {
      color: Colors.textSecondary,
    },
    signInButton: {
      backgroundColor: Colors.primary,
      ...Shadow.gold,
    },
    signInButtonText: {
      color: Colors.textPrimary,
    },
    creditsBanner: {
      ...Shadow.gold,
    },
    statCard: {
      backgroundColor: Colors.surface,
      borderColor: Colors.border,
      ...Shadow.sm,
    },
    statCardGold: {
      borderColor: Colors.borderGold,
      backgroundColor: Colors.primaryGlow,
    },
    statValue: {
      color: Colors.textPrimary,
    },
    statLabel: {
      color: Colors.textMuted,
    },
    earningsCard: {
      backgroundColor: Colors.surface,
      borderColor: Colors.borderGold,
      ...Shadow.goldSm,
    },
    earningsLabel: {
      color: Colors.textMuted,
    },
    menuSectionTitle: {
      color: Colors.textMuted,
    },
    menuItem: {
      backgroundColor: Colors.surface,
      borderColor: Colors.border,
      ...Shadow.sm,
    },
    menuItemGold: {
      borderColor: Colors.borderGold,
      backgroundColor: Colors.primaryGlow,
    },
    menuItemTitle: {
      color: Colors.textPrimary,
    },
    menuItemSubtitle: {
      color: Colors.textSecondary,
    },
    displayName: {
      color: Colors.textPrimary,
    },
    username: {
      color: Colors.textMuted,
    },
    signOutText: {
      color: Colors.error,
    },
    version: {
      color: Colors.textMuted,
    },
  };

  const handlePickAvatar = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow photo access to update your profile picture.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      const uri = result.assets[0].uri;
      setLocalAvatarUri(uri);
      // Upload to Supabase storage
      try {
        const ext = uri.split('.').pop() ?? 'jpg';
        const path = `avatars/${profile?.id}.${ext}`;
        const response = await fetch(uri);
        const blob = await response.blob();
        const { error: uploadError } = await supabase.storage.from('avatars').upload(path, blob, { upsert: true });
        if (!uploadError) {
          const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path);
          await supabase.from('profiles').update({ avatar_url: urlData.publicUrl }).eq('id', profile!.id);
        }
      } catch (e) {
        console.warn('Avatar upload failed:', e);
      }
    }
  };

  if (!isAuthenticated || !profile) {
    return (
      <View style={[styles.centered, dynamicStyles.centered]}>
        <View style={[styles.signInIconWrap, dynamicStyles.signInIconWrap]}>
          <Ionicons name="person-circle-outline" size={72} color={Colors.primary} />
        </View>
        <Text style={[styles.signInTitle, dynamicStyles.signInTitle]}>Join the Competition</Text>
        <Text style={[styles.signInSub, dynamicStyles.signInSub]}>Sign in to track your wins, earnings, and stats.</Text>
        <TouchableOpacity
          style={[styles.signInButton, dynamicStyles.signInButton]}
          onPress={() => router.push('/(auth)/welcome')}
          activeOpacity={0.85}
        >
          <Text style={[styles.signInButtonText, dynamicStyles.signInButtonText]}>Sign In</Text>
          <Ionicons name="arrow-forward" size={18} color={Colors.textPrimary} />
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
  const entered = profile.competitions_entered ?? 0;
  const won = profile.competitions_won ?? 0;
  const winRate = entered > 0 ? Math.round((won / entered) * 100) : null;

  return (
    <ScrollView
      style={[styles.container, dynamicStyles.container]}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      {/* ─── Profile Header ─── */}
      <View style={styles.profileHeader}>
        <TouchableOpacity onPress={handlePickAvatar} activeOpacity={0.8}>
          {profile.avatar_url || localAvatarUri ? (
            <Image source={{ uri: localAvatarUri ?? profile.avatar_url! }} style={styles.avatar} />
          ) : (
            <LinearGradient
              colors={[Colors.primaryLight ?? '#338AFF', Colors.primaryDark ?? '#0040CC']}
              style={[styles.avatar, styles.avatarGradient]}
            >
              <Text style={styles.avatarInitial}>
                {(profile.display_name ?? profile.username ?? 'U')[0].toUpperCase()}
              </Text>
            </LinearGradient>
          )}
          <View style={styles.avatarEditBadge}>
            <Ionicons name="camera" size={12} color="#fff" />
          </View>
        </TouchableOpacity>
        <Text style={[styles.displayName, dynamicStyles.displayName]}>{profile.display_name ?? profile.username ?? 'Champion'}</Text>
        {profile.username && (
          <Text style={[styles.username, dynamicStyles.username]}>@{profile.username}</Text>
        )}
      </View>


      {/* ─── Pro Banner ─── */}
      {proStatus.isPro ? (
        <View style={[styles.proBanner, { backgroundColor: Colors.primaryGlow, borderColor: Colors.borderGold }]}>
          <View style={styles.proBannerLeft}>
            <Text style={[styles.proBannerBadge, { color: Colors.accentGold }]}>⭐ PODIUM PRO</Text>
            <Text style={[styles.proBannerSub, { color: Colors.textSecondary }]}>
              {proStatus.daysRemaining !== null ? `${proStatus.daysRemaining} days remaining` : 'Active'}
            </Text>
          </View>
          <Text style={[styles.proBannerFee, { color: Colors.success }]}>0% fees</Text>
        </View>
      ) : (
        <TouchableOpacity
          style={[styles.proUpgradeBanner, { backgroundColor: Colors.surface, borderColor: Colors.border }]}
          onPress={() => router.push('/pro-upgrade')}
          activeOpacity={0.85}
        >
          <View>
            <Text style={[styles.proUpgradeTitle, { color: Colors.textPrimary }]}>⭐ Upgrade to Pro</Text>
            <Text style={[styles.proUpgradeSub, { color: Colors.textSecondary }]}>Keep 100% of your winnings · $9.99/mo</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={Colors.primary} />
        </TouchableOpacity>
      )}

      {/* ─── Credits Banner ─── */}
      {creditsBalance > 0 && (
        <TouchableOpacity style={[styles.creditsBanner, dynamicStyles.creditsBanner]} activeOpacity={0.85}>
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
        <View style={[styles.statCard, dynamicStyles.statCard]}>
          <Text style={[styles.statValue, dynamicStyles.statValue]}>{entered}</Text>
          <Text style={[styles.statLabel, dynamicStyles.statLabel]}>Competed</Text>
        </View>
        <View style={[styles.statCard, dynamicStyles.statCard, dynamicStyles.statCardGold]}>
          <Text style={[styles.statValue, { color: Colors.accentGold }]}>
            {won}
          </Text>
          <Text style={[styles.statLabel, dynamicStyles.statLabel]}>Won 🏆</Text>
        </View>
        <View style={[styles.statCard, dynamicStyles.statCard]}>
          <Text style={[styles.statValue, { color: Colors.success }]}>
            {winRate !== null ? `${winRate}%` : '—'}
          </Text>
          <Text style={[styles.statLabel, dynamicStyles.statLabel]}>Win Rate</Text>
        </View>
      </View>

      {/* ─── Total Earnings ─── */}
      {(profile.total_winnings ?? 0) > 0 && (
        <View style={[styles.earningsCard, dynamicStyles.earningsCard]}>
          <View>
            <Text style={[styles.earningsLabel, dynamicStyles.earningsLabel]}>Total Earnings</Text>
            <Text style={styles.earningsAmount}>
              {formatCents(profile.total_winnings * 100)}
            </Text>
          </View>
          <Ionicons name="trophy" size={32} color={Colors.primary} />
        </View>
      )}

      {/* ─── Connected Apps ─── */}
      <View style={styles.menuSection}>
        <Text style={[styles.menuSectionTitle, dynamicStyles.menuSectionTitle]}>Connected Apps</Text>
        {isHealthKitAvailable() && (
          <TouchableOpacity style={[styles.menuItem, dynamicStyles.menuItem]} onPress={handleConnectHealth} activeOpacity={0.7}>
            <View style={[styles.menuIconBg, { backgroundColor: '#FF375F18' }]}>
              <Ionicons name="heart" size={20} color="#FF375F" />
            </View>
            <View style={styles.menuItemContent}>
              <Text style={[styles.menuItemTitle, dynamicStyles.menuItemTitle]}>Apple Health</Text>
              <Text style={[styles.menuItemSubtitle, dynamicStyles.menuItemSubtitle]}>Auto-sync workouts & steps</Text>
            </View>
            <Ionicons name="checkmark-circle" size={20} color={Colors.success} />
          </TouchableOpacity>
        )}
      </View>

      {/* ─── Wallet ─── */}
      <View style={styles.menuSection}>
        <Text style={[styles.menuSectionTitle, dynamicStyles.menuSectionTitle]}>Wallet</Text>
        <TouchableOpacity style={[styles.menuItem, dynamicStyles.menuItem]} activeOpacity={0.7} onPress={() => Alert.alert('Coming Soon', 'Payment methods setup coming in the next update.')}>
          <View style={[styles.menuIconBg, { backgroundColor: '#6772E518' }]}>
            <Ionicons name="card" size={20} color="#6772E5" />
          </View>
          <View style={styles.menuItemContent}>
            <Text style={[styles.menuItemTitle, dynamicStyles.menuItemTitle]}>Payment Methods</Text>
            <Text style={[styles.menuItemSubtitle, dynamicStyles.menuItemSubtitle]}>Cards, Apple Pay & bank transfers</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
        </TouchableOpacity>
        <TouchableOpacity style={[styles.menuItem, dynamicStyles.menuItem]} activeOpacity={0.7} onPress={() => Alert.alert('Coming Soon', 'USDC wallet connection coming in the next update.')}>
          <View style={[styles.menuIconBg, { backgroundColor: '#2775CA18' }]}>
            <Ionicons name="wallet" size={20} color="#2775CA" />
          </View>
          <View style={styles.menuItemContent}>
            <Text style={[styles.menuItemTitle, dynamicStyles.menuItemTitle]}>USDC Wallet</Text>
            <Text style={[styles.menuItemSubtitle, dynamicStyles.menuItemSubtitle]}>
              {profile.wallet_address
                ? `${profile.wallet_address.slice(0, 6)}...${profile.wallet_address.slice(-4)}`
                : 'Not connected — tap to add'}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
        </TouchableOpacity>
        {credits.canRedeem && (
          <TouchableOpacity style={[styles.menuItem, dynamicStyles.menuItem, dynamicStyles.menuItemGold]} activeOpacity={0.7}>
            <View style={[styles.menuIconBg, { backgroundColor: Colors.primaryGlow }]}>
              <Ionicons name="gift" size={20} color={Colors.primary} />
            </View>
            <View style={styles.menuItemContent}>
              <Text style={[styles.menuItemTitle, { color: Colors.primary }]}>Redeem Credits</Text>
              <Text style={[styles.menuItemSubtitle, dynamicStyles.menuItemSubtitle]}>{credits.label} ready to cash out</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={Colors.primary} />
          </TouchableOpacity>
        )}
      </View>

      {/* ─── Settings ─── */}
      <View style={styles.menuSection}>
        <Text style={[styles.menuSectionTitle, dynamicStyles.menuSectionTitle]}>Settings</Text>
        <TouchableOpacity style={[styles.menuItem, dynamicStyles.menuItem]} activeOpacity={0.7} onPress={() => Alert.alert('Coming Soon', 'Push notifications coming soon.')}>
          <View style={[styles.menuIconBg, { backgroundColor: Colors.textMuted + '18' }]}>
            <Ionicons name="notifications" size={20} color={Colors.textMuted} />
          </View>
          <View style={styles.menuItemContent}>
            <Text style={[styles.menuItemTitle, dynamicStyles.menuItemTitle]}>Notifications</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.menuItem, dynamicStyles.menuItem]}
          activeOpacity={0.7}
          onPress={() => router.push('/(onboarding)/age-verify')}
        >
          <View style={[styles.menuIconBg, { backgroundColor: '#22C55E18' }]}>
            <Ionicons name="shield-checkmark" size={20} color={Colors.success} />
          </View>
          <View style={styles.menuItemContent}>
            <Text style={[styles.menuItemTitle, dynamicStyles.menuItemTitle]}>Age Verification</Text>
            <Text style={[styles.menuItemSubtitle, dynamicStyles.menuItemSubtitle]}>Required for paid competitions</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
        </TouchableOpacity>
        <TouchableOpacity style={[styles.menuItem, dynamicStyles.menuItem]} activeOpacity={0.7} onPress={() => Linking.openURL('https://podiumapp.fit/privacy')}>
          <View style={[styles.menuIconBg, { backgroundColor: Colors.textMuted + '18' }]}>
            <Ionicons name="document-text" size={20} color={Colors.textMuted} />
          </View>
          <View style={styles.menuItemContent}>
            <Text style={[styles.menuItemTitle, dynamicStyles.menuItemTitle]}>Terms & Privacy</Text>
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
        <Text style={[styles.signOutText, dynamicStyles.signOutText]}>Sign Out</Text>
      </TouchableOpacity>

      {/* Version */}
      <Text style={[styles.version, dynamicStyles.version]}>Podium v1.0.0</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.lg,
    paddingBottom: 120,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xxxl,
  },
  signInIconWrap: {
    width: 96,
    height: 96,
    borderRadius: 48,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  signInTitle: {
    fontSize: FontSize.xxl,
    fontWeight: '800',
    marginBottom: Spacing.sm,
  },
  signInSub: {
    fontSize: FontSize.sm,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: Spacing.xxxl,
  },
  signInButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.xxxl,
    paddingVertical: Spacing.lg,
    borderRadius: BorderRadius.lg,
  },
  signInButtonText: {
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
  avatarEditBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FF5A1F',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#F8F8F8',
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
    letterSpacing: -0.5,
  },
  username: {
    fontSize: FontSize.sm,
    marginTop: Spacing.xs,
  },
  proBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    marginBottom: Spacing.xl,
  },
  proBannerLeft: {
    flex: 1,
  },
  proBannerBadge: {
    fontSize: FontSize.sm,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  proBannerSub: {
    fontSize: FontSize.xs,
    marginTop: 2,
  },
  proBannerFee: {
    fontSize: FontSize.md,
    fontWeight: '800',
  },
  proUpgradeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    marginBottom: Spacing.xl,
  },
  proUpgradeTitle: {
    fontSize: FontSize.md,
    fontWeight: '700',
  },
  proUpgradeSub: {
    fontSize: FontSize.xs,
    marginTop: 2,
  },
  creditsBanner: {
    marginBottom: Spacing.xl,
    borderRadius: BorderRadius.xl,
    overflow: 'hidden',
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
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    alignItems: 'center',
    borderWidth: 1,
  },
  statValue: {
    fontSize: FontSize.xxl,
    fontWeight: '900',
  },
  statLabel: {
    fontSize: FontSize.xs,
    fontWeight: '600',
    marginTop: Spacing.xs,
  },
  earningsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: BorderRadius.lg,
    padding: Spacing.xl,
    marginBottom: Spacing.xl,
    borderWidth: 1,
  },
  earningsLabel: {
    fontSize: FontSize.xs,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  earningsAmount: {
    fontSize: FontSize.xxxl,
    fontWeight: '900',
    color: '#C9A84C',
  },
  menuSection: {
    marginBottom: Spacing.xxl,
  },
  menuSectionTitle: {
    fontSize: FontSize.xs,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: Spacing.md,
    paddingLeft: Spacing.xs,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.sm,
    borderWidth: 1,
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
  },
  menuItemSubtitle: {
    fontSize: FontSize.sm,
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
  },
  version: {
    textAlign: 'center',
    fontSize: FontSize.xs,
    marginTop: Spacing.sm,
  },
});
