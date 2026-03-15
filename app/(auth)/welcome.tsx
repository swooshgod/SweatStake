import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  ImageBackground,
  StatusBar,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, BorderRadius, FontSize, Shadow } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';

// Attractive fit couple at the gym — faces visible, aspirational energy
const BG_IMAGE = {
  uri: 'https://images.unsplash.com/photo-1541534741688-6078c6bfb5c5?w=1080&q=90&fit=crop',
};

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
      const { error } = await supabase.auth.signInWithOAuth({ provider: 'google' });
      if (error) throw error;
      router.replace('/(tabs)');
    } catch (error) {
      console.error('Google Sign-In error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ImageBackground source={BG_IMAGE} style={styles.bg} resizeMode="cover">
      <StatusBar barStyle="light-content" />

      {/* Subtle gradient — light touch on top, stronger only at the very bottom for UI */}
      <LinearGradient
        colors={[
          'rgba(0,0,0,0.30)',   // top — just enough for wordmark
          'rgba(0,0,0,0.00)',   // mid — photo shines through fully
          'rgba(0,0,0,0.00)',   // upper-mid — clear
          'rgba(0,0,0,0.75)',   // lower — fade in for text
          'rgba(0,0,0,0.95)',   // bottom — solid for buttons
        ]}
        locations={[0, 0.2, 0.45, 0.72, 1]}
        style={StyleSheet.absoluteFill}
      />

      {/* Top wordmark */}
      <View style={styles.topBar}>
        <View style={styles.medalBadge}>
          <Ionicons name="medal" size={18} color={Colors.accent} />
        </View>
        <Text style={styles.wordmark}>PODIUM</Text>
      </View>

      {/* Bottom content */}
      <View style={styles.bottom}>
        {/* Hero copy */}
        <View style={styles.heroText}>
          <Text style={styles.headline}>Where Winners{'\n'}Stand.</Text>
          <Text style={styles.subline}>
            Create fitness competitions, track automatically{'\n'}with Apple Health, and claim the prize.
          </Text>
        </View>

        {/* Feature pills */}
        <View style={styles.pills}>
          <View style={styles.pill}>
            <Ionicons name="trophy" size={13} color={Colors.accent} />
            <Text style={styles.pillText}>Real prizes</Text>
          </View>
          <View style={styles.pill}>
            <Ionicons name="heart" size={13} color="#FF4D4D" />
            <Text style={styles.pillText}>Auto-tracked</Text>
          </View>
          <View style={styles.pill}>
            <Ionicons name="people" size={13} color="#4ADE80" />
            <Text style={styles.pillText}>Public & private</Text>
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
              <Ionicons name="logo-apple" size={20} color="#fff" />
              <Text style={styles.appleButtonText}>Sign in with Apple</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={styles.googleButton}
            activeOpacity={0.85}
            onPress={handleGoogleSignIn}
            disabled={loading}
          >
            <Ionicons name="logo-google" size={18} color={Colors.textPrimary} />
            <Text style={styles.googleButtonText}>Sign in with Google</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.skipButton}
            onPress={() => router.replace('/(tabs)')}
          >
            <Text style={styles.skipText}>Browse without signing in →</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.legal}>
          By continuing, you agree to our Terms & Privacy Policy
        </Text>
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  bg: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  topBar: {
    position: 'absolute',
    top: 60,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  medalBadge: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(255,215,0,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  wordmark: {
    fontSize: 22,
    fontWeight: '900',
    color: '#fff',
    letterSpacing: 6,
  },
  bottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: Spacing.xxl,
    paddingBottom: 48,
  },
  heroText: {
    marginBottom: 24,
  },
  headline: {
    fontSize: 44,
    fontWeight: '900',
    color: '#fff',
    lineHeight: 50,
    letterSpacing: -1.5,
    marginBottom: 12,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
  subline: {
    fontSize: FontSize.sm,
    color: 'rgba(255,255,255,0.85)',
    lineHeight: 20,
    fontWeight: '500',
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  pills: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 28,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(0,0,0,0.45)',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  pillText: {
    fontSize: 12,
    color: '#fff',
    fontWeight: '600',
  },
  authButtons: {
    gap: Spacing.md,
    marginBottom: Spacing.lg,
  },
  appleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#000',
    paddingVertical: 16,
    borderRadius: BorderRadius.lg,
    gap: Spacing.sm,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
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
    paddingVertical: 16,
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
    paddingVertical: 10,
  },
  skipText: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: FontSize.sm,
    fontWeight: '500',
  },
  legal: {
    textAlign: 'center',
    color: 'rgba(255,255,255,0.25)',
    fontSize: 11,
  },
});
