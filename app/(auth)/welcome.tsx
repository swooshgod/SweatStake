import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  ImageBackground,
  Image,
  StatusBar,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, BorderRadius, FontSize, Shadow } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';

const BG_IMAGE = {
  uri: 'https://images.unsplash.com/photo-1541534741688-6078c6bfb5c5?w=1080&q=90&fit=crop',
};

export default function WelcomeScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ modal?: string }>();
  const isModal = params.modal === '1';
  const { signInWithApple } = useAuth();
  const [loading, setLoading] = React.useState(false);

  const handleAppleSignIn = async () => {
    setLoading(true);
    try {
      await signInWithApple();
      if (isModal) {
        router.back();
      } else {
        router.replace('/(tabs)');
      }
    } catch (error) {
      console.error('Apple Sign-In error:', error);
      Alert.alert('Sign-In Failed', 'Something went wrong with Apple Sign-In. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // ─── Modal / bottom-sheet variant ───
  if (isModal) {
    return (
      <View style={modalStyles.container}>
        <StatusBar barStyle="light-content" />
        <View style={modalStyles.handle} />
        <Image
          source={require('@/assets/icon.png')}
          style={modalStyles.logo}
          resizeMode="contain"
        />
        <Text style={modalStyles.title}>Sign in to continue</Text>
        <Text style={modalStyles.subtitle}>
          Create competitions, join challenges, and win prizes.
        </Text>

        <View style={modalStyles.buttons}>
          {Platform.OS === 'ios' && (
            <TouchableOpacity
              style={modalStyles.appleButton}
              activeOpacity={0.85}
              onPress={handleAppleSignIn}
              disabled={loading}
            >
              <Ionicons name="logo-apple" size={20} color="#fff" />
              <Text style={modalStyles.appleButtonText}>Sign in with Apple</Text>
            </TouchableOpacity>
          )}
        </View>

        <TouchableOpacity style={modalStyles.cancelButton} onPress={() => router.back()}>
          <Text style={modalStyles.cancelText}>Cancel</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ─── Full-screen welcome (first launch) ───
  return (
    <ImageBackground source={BG_IMAGE} style={styles.bg} resizeMode="cover">
      <StatusBar barStyle="light-content" />

      <LinearGradient
        colors={[
          'rgba(0,0,0,0.40)',
          'rgba(0,0,0,0.05)',
          'rgba(0,0,0,0.50)',
          'rgba(0,0,0,0.82)',
          'rgba(0,0,0,0.97)',
        ]}
        locations={[0, 0.22, 0.48, 0.68, 1]}
        style={StyleSheet.absoluteFill}
      />

      {/* Top wordmark */}
      <View style={styles.topBar}>
        <Text style={styles.wordmark}>PODIUM</Text>
      </View>

      {/* Bottom content */}
      <View style={styles.bottom}>
        <View style={styles.heroText}>
          <Text style={styles.headline}>Where Winners{'\n'}Stand.</Text>
          <Text style={styles.subline}>
            Step challenges, weight loss contests, workout{'\n'}streaks & more — tracked with Apple Health.
          </Text>
        </View>

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
            style={styles.skipButton}
            onPress={() => router.replace('/(tabs)')}
          >
            <Text style={styles.skipText}>Browse without signing in</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.legal}>
          By continuing, you agree to our Terms & Privacy Policy
        </Text>
      </View>
    </ImageBackground>
  );
}

// ─── Modal styles ───
const modalStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    alignItems: 'center',
    paddingHorizontal: Spacing.xxl,
    paddingTop: Spacing.lg,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.textMuted,
    marginBottom: Spacing.xxxl,
  },
  logo: {
    width: 56,
    height: 56,
    marginBottom: Spacing.lg,
  },
  title: {
    fontSize: FontSize.xxl,
    fontWeight: '800',
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
  },
  subtitle: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: Spacing.xxxl,
  },
  buttons: {
    width: '100%',
    gap: Spacing.md,
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
  cancelButton: {
    marginTop: Spacing.xxl,
    paddingVertical: Spacing.md,
  },
  cancelText: {
    fontSize: FontSize.md,
    color: Colors.textMuted,
    fontWeight: '500',
  },
});

// ─── Full-screen styles ───
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
  logoImg: {
    width: 32,
    height: 32,
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
    textShadow: '0px 2px 8px rgba(0,0,0,0.5)',
  },
  subline: {
    fontSize: FontSize.sm,
    color: 'rgba(255,255,255,0.85)',
    lineHeight: 20,
    fontWeight: '500',
    textShadow: '0px 1px 4px rgba(0,0,0,0.8)',
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
