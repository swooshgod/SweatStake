import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, BorderRadius, FontSize, Shadow } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';

export default function WelcomeScreen() {
  const router = useRouter();
  const { signInWithApple } = useAuth();
  const [loading, setLoading] = React.useState(false);

  const handleAppleSignIn = async () => {
    setLoading(true);
    try {
      await signInWithApple();
      router.replace('/(tabs)');
    } catch (error) {
      console.error('Apple Sign-In error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
      });
      if (error) throw error;
      router.replace('/(tabs)');
    } catch (error) {
      console.error('Google Sign-In error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Background decoration */}
      <View style={styles.topDecoration}>
        <View style={styles.circle1} />
        <View style={styles.circle2} />
      </View>

      {/* Logo area */}
      <View style={styles.logoContainer}>
        <View style={styles.logoIcon}>
          <Ionicons name="flame" size={48} color="#fff" />
        </View>
        <Text style={styles.appName}>SweatStake</Text>
        <Text style={styles.tagline}>
          Compete. Track. Win.
        </Text>
      </View>

      {/* Features */}
      <View style={styles.features}>
        <View style={styles.featureRow}>
          <View style={styles.featureIcon}>
            <Ionicons name="trophy" size={20} color={Colors.accent} />
          </View>
          <Text style={styles.featureText}>Win real prizes in fitness competitions</Text>
        </View>
        <View style={styles.featureRow}>
          <View style={styles.featureIcon}>
            <Ionicons name="heart" size={20} color={Colors.primary} />
          </View>
          <Text style={styles.featureText}>Auto-track with Apple Health</Text>
        </View>
        <View style={styles.featureRow}>
          <View style={styles.featureIcon}>
            <Ionicons name="people" size={20} color={Colors.success} />
          </View>
          <Text style={styles.featureText}>Challenge friends or join public comps</Text>
        </View>
      </View>

      {/* Auth buttons */}
      <View style={styles.authButtons}>
        {Platform.OS === 'ios' && (
          <TouchableOpacity
            style={styles.appleButton}
            activeOpacity={0.85}
            onPress={handleAppleSignIn}
            disabled={loading}
          >
            <Ionicons name="logo-apple" size={22} color="#fff" />
            <Text style={styles.appleButtonText}>Sign in with Apple</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={styles.googleButton}
          activeOpacity={0.85}
          onPress={handleGoogleSignIn}
          disabled={loading}
        >
          <Ionicons name="logo-google" size={20} color={Colors.textPrimary} />
          <Text style={styles.googleButtonText}>Sign in with Google</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.skipButton}
          onPress={() => router.replace('/(tabs)')}
        >
          <Text style={styles.skipText}>Browse without signing in</Text>
        </TouchableOpacity>
      </View>

      {/* Legal */}
      <Text style={styles.legal}>
        By signing in, you agree to our Terms of Service and Privacy Policy.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.secondary,
    justifyContent: 'flex-end',
    padding: Spacing.xxl,
    paddingBottom: 48,
  },
  topDecoration: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 300,
  },
  circle1: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: Colors.primary + '15',
    top: -40,
    right: -40,
  },
  circle2: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: Colors.accent + '10',
    top: 80,
    left: -30,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 48,
  },
  logoIcon: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.lg,
    ...Shadow.lg,
  },
  appName: {
    fontSize: FontSize.hero,
    fontWeight: '900',
    color: '#fff',
    letterSpacing: -1,
  },
  tagline: {
    fontSize: FontSize.lg,
    color: 'rgba(255,255,255,0.6)',
    marginTop: Spacing.sm,
    fontWeight: '500',
  },
  features: {
    marginBottom: 48,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  featureIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.08)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  featureText: {
    fontSize: FontSize.md,
    color: 'rgba(255,255,255,0.8)',
    fontWeight: '500',
    flex: 1,
  },
  authButtons: {
    gap: Spacing.md,
    marginBottom: Spacing.xxl,
  },
  appleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#000',
    paddingVertical: Spacing.lg,
    borderRadius: BorderRadius.lg,
    gap: Spacing.sm,
  },
  appleButtonText: {
    color: '#fff',
    fontSize: FontSize.md,
    fontWeight: '700',
  },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    paddingVertical: Spacing.lg,
    borderRadius: BorderRadius.lg,
    gap: Spacing.sm,
  },
  googleButtonText: {
    color: Colors.textPrimary,
    fontSize: FontSize.md,
    fontWeight: '700',
  },
  skipButton: {
    alignItems: 'center',
    paddingVertical: Spacing.md,
  },
  skipText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: FontSize.sm,
    fontWeight: '500',
  },
  legal: {
    textAlign: 'center',
    color: 'rgba(255,255,255,0.3)',
    fontSize: FontSize.xs,
    lineHeight: 16,
  },
});
