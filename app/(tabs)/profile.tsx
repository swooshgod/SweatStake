import React from 'react';
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
import { Colors, Spacing, BorderRadius, FontSize, Shadow } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { isHealthKitAvailable, requestHealthKitPermissions } from '@/lib/healthkit';
import { formatCents } from '@/lib/stripe';

export default function ProfileScreen() {
  const router = useRouter();
  const { profile, isAuthenticated, signOut } = useAuth();

  if (!isAuthenticated || !profile) {
    return (
      <View style={styles.centered}>
        <Ionicons name="person-circle-outline" size={80} color={Colors.textMuted} />
        <Text style={styles.signInPrompt}>Sign in to see your profile</Text>
        <TouchableOpacity
          style={styles.signInButton}
          onPress={() => router.push('/(auth)/welcome')}
        >
          <Text style={styles.signInButtonText}>Sign In</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const handleConnectHealth = async () => {
    const granted = await requestHealthKitPermissions();
    if (granted) {
      Alert.alert('Connected', 'Apple Health is now connected!');
    } else {
      Alert.alert('Permission Denied', 'Please enable Health access in Settings.');
    }
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      {/* Profile header */}
      <View style={styles.profileHeader}>
        {profile.avatar_url ? (
          <Image source={{ uri: profile.avatar_url }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarPlaceholder]}>
            <Text style={styles.avatarInitial}>
              {(profile.display_name ?? 'U')[0].toUpperCase()}
            </Text>
          </View>
        )}
        <Text style={styles.displayName}>{profile.display_name ?? 'User'}</Text>
        {profile.username && (
          <Text style={styles.username}>@{profile.username}</Text>
        )}
      </View>

      {/* Stats cards */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{profile.competitions_entered}</Text>
          <Text style={styles.statLabel}>Entered</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statValue, { color: Colors.accent }]}>
            {profile.competitions_won}
          </Text>
          <Text style={styles.statLabel}>Won</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statValue, { color: Colors.success }]}>
            {formatCents(profile.total_winnings * 100)}
          </Text>
          <Text style={styles.statLabel}>Earned</Text>
        </View>
      </View>

      {/* Menu sections */}
      <View style={styles.menuSection}>
        <Text style={styles.menuSectionTitle}>Connected Apps</Text>
        {isHealthKitAvailable() && (
          <TouchableOpacity style={styles.menuItem} onPress={handleConnectHealth}>
            <View style={[styles.menuIconBg, { backgroundColor: '#FF375F18' }]}>
              <Ionicons name="heart" size={20} color="#FF375F" />
            </View>
            <View style={styles.menuItemContent}>
              <Text style={styles.menuItemTitle}>Apple Health</Text>
              <Text style={styles.menuItemSubtitle}>Auto-sync workouts & steps</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={Colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.menuSection}>
        <Text style={styles.menuSectionTitle}>Wallet</Text>
        <TouchableOpacity style={styles.menuItem}>
          <View style={[styles.menuIconBg, { backgroundColor: '#6772E518' }]}>
            <Ionicons name="card" size={20} color="#6772E5" />
          </View>
          <View style={styles.menuItemContent}>
            <Text style={styles.menuItemTitle}>Payment Methods</Text>
            <Text style={styles.menuItemSubtitle}>Manage Stripe payments</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={Colors.textMuted} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.menuItem}>
          <View style={[styles.menuIconBg, { backgroundColor: '#2775CA18' }]}>
            <Ionicons name="wallet" size={20} color="#2775CA" />
          </View>
          <View style={styles.menuItemContent}>
            <Text style={styles.menuItemTitle}>USDC Wallet</Text>
            <Text style={styles.menuItemSubtitle}>
              {profile.wallet_address
                ? `${profile.wallet_address.slice(0, 6)}...${profile.wallet_address.slice(-4)}`
                : 'Not connected'}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={Colors.textMuted} />
        </TouchableOpacity>
      </View>

      <View style={styles.menuSection}>
        <Text style={styles.menuSectionTitle}>Settings</Text>
        <TouchableOpacity style={styles.menuItem}>
          <View style={[styles.menuIconBg, { backgroundColor: Colors.textMuted + '18' }]}>
            <Ionicons name="notifications" size={20} color={Colors.textMuted} />
          </View>
          <View style={styles.menuItemContent}>
            <Text style={styles.menuItemTitle}>Notifications</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={Colors.textMuted} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.menuItem}>
          <View style={[styles.menuIconBg, { backgroundColor: Colors.textMuted + '18' }]}>
            <Ionicons name="shield-checkmark" size={20} color={Colors.textMuted} />
          </View>
          <View style={styles.menuItemContent}>
            <Text style={styles.menuItemTitle}>Privacy</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={Colors.textMuted} />
        </TouchableOpacity>
      </View>

      {/* Sign out */}
      <TouchableOpacity
        style={styles.signOutButton}
        onPress={() => {
          Alert.alert('Sign Out', 'Are you sure?', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Sign Out', style: 'destructive', onPress: signOut },
          ]);
        }}
      >
        <Text style={styles.signOutText}>Sign Out</Text>
      </TouchableOpacity>
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
    paddingBottom: 100,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
    padding: Spacing.xxxl,
  },
  signInPrompt: {
    fontSize: FontSize.lg,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginTop: Spacing.lg,
    marginBottom: Spacing.xl,
  },
  signInButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.xxxl,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
  },
  signInButtonText: {
    color: '#fff',
    fontSize: FontSize.md,
    fontWeight: '700',
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
  avatarPlaceholder: {
    backgroundColor: Colors.primary + '20',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitial: {
    fontSize: FontSize.xxxl,
    fontWeight: '800',
    color: Colors.primary,
  },
  displayName: {
    fontSize: FontSize.xxl,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  username: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
    marginTop: Spacing.xs,
  },
  statsRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginBottom: Spacing.xxl,
  },
  statCard: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    alignItems: 'center',
    ...Shadow.sm,
  },
  statValue: {
    fontSize: FontSize.xxl,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  statLabel: {
    fontSize: FontSize.xs,
    fontWeight: '600',
    color: Colors.textMuted,
    marginTop: Spacing.xs,
  },
  menuSection: {
    marginBottom: Spacing.xxl,
  },
  menuSectionTitle: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: Spacing.md,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.sm,
    ...Shadow.sm,
  },
  menuIconBg: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.sm,
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
    alignItems: 'center',
    paddingVertical: Spacing.lg,
    marginTop: Spacing.lg,
  },
  signOutText: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.error,
  },
});
