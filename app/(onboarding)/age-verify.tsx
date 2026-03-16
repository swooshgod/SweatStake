import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, BorderRadius, FontSize, Shadow } from '@/constants/theme';
import { verifyAge, saveAgeVerification, MIN_AGE } from '@/lib/compliance';

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const DAYS = Array.from({ length: 31 }, (_, i) => i + 1);
const currentYear = new Date().getFullYear();
const YEARS = Array.from({ length: 100 }, (_, i) => currentYear - i);

// ---------------------------------------------------------------------------
// Picker component
// ---------------------------------------------------------------------------

interface ScrollPickerProps {
  items: (string | number)[];
  selectedIndex: number;
  onSelect: (index: number) => void;
  width: number;
}

function ScrollPicker({ items, selectedIndex, onSelect, width }: ScrollPickerProps) {
  return (
    <ScrollView
      style={[styles.picker, { width }]}
      showsVerticalScrollIndicator={false}
      snapToInterval={44}
      decelerationRate="fast"
      contentContainerStyle={{ paddingVertical: 44 }}
    >
      {items.map((item, index) => (
        <TouchableOpacity
          key={index}
          style={[styles.pickerItem, index === selectedIndex && styles.pickerItemSelected]}
          onPress={() => onSelect(index)}
        >
          <Text
            style={[
              styles.pickerItemText,
              index === selectedIndex && styles.pickerItemTextSelected,
            ]}
          >
            {item}
          </Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------

export default function AgeVerifyScreen() {
  const router = useRouter();
  const [monthIndex, setMonthIndex] = useState(0);
  const [dayIndex, setDayIndex] = useState(0);
  const [yearIndex, setYearIndex] = useState(17); // Default ~18 years ago
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [verified, setVerified] = useState(false);

  const handleConfirm = async () => {
    setError(null);
    setLoading(true);

    try {
      const month = monthIndex; // 0-indexed
      const day = DAYS[dayIndex];
      const year = YEARS[yearIndex];
      const birthdate = new Date(year, month, day);

      if (!verifyAge(birthdate)) {
        setError(`You must be ${MIN_AGE} or older to participate in paid competitions.`);
        setLoading(false);
        return;
      }

      await saveAgeVerification(birthdate);
      setVerified(true);

      // Navigate after brief success state
      setTimeout(() => {
        router.replace('/(tabs)');
      }, 800);
    } catch (e) {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.iconContainer}>
            <Ionicons name="shield-checkmark" size={36} color={Colors.primary} />
          </View>
          <Text style={styles.wordmark}>PODIUM</Text>
          <Text style={styles.headline}>Age Verification</Text>
          <Text style={styles.subtitle}>
            You must be {MIN_AGE} or older to enter paid competitions.
            Enter your date of birth to continue.
          </Text>
        </View>

        {/* Date pickers */}
        <View style={styles.pickerSection}>
          <Text style={styles.pickerLabel}>Date of Birth</Text>
          <View style={styles.pickerRow}>
            {/* Month */}
            <View style={styles.pickerColumn}>
              <Text style={styles.pickerColumnLabel}>Month</Text>
              <View style={styles.pickerWrapper}>
                <ScrollPicker
                  items={MONTHS}
                  selectedIndex={monthIndex}
                  onSelect={setMonthIndex}
                  width={120}
                />
                <View style={styles.pickerHighlight} pointerEvents="none" />
              </View>
            </View>

            {/* Day */}
            <View style={styles.pickerColumn}>
              <Text style={styles.pickerColumnLabel}>Day</Text>
              <View style={styles.pickerWrapper}>
                <ScrollPicker
                  items={DAYS}
                  selectedIndex={dayIndex}
                  onSelect={setDayIndex}
                  width={64}
                />
                <View style={styles.pickerHighlight} pointerEvents="none" />
              </View>
            </View>

            {/* Year */}
            <View style={styles.pickerColumn}>
              <Text style={styles.pickerColumnLabel}>Year</Text>
              <View style={styles.pickerWrapper}>
                <ScrollPicker
                  items={YEARS}
                  selectedIndex={yearIndex}
                  onSelect={setYearIndex}
                  width={80}
                />
                <View style={styles.pickerHighlight} pointerEvents="none" />
              </View>
            </View>
          </View>
        </View>

        {/* Error */}
        {error && (
          <View style={styles.errorBox}>
            <Ionicons name="alert-circle" size={18} color="#FF4D4D" />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* Success */}
        {verified && (
          <View style={styles.successBox}>
            <Ionicons name="checkmark-circle" size={18} color={Colors.success ?? '#22C55E'} />
            <Text style={styles.successText}>Verified! Taking you in…</Text>
          </View>
        )}

        {/* Confirm button */}
        <TouchableOpacity
          style={[styles.confirmButton, (loading || verified) && { opacity: 0.6 }]}
          onPress={handleConfirm}
          disabled={loading || verified}
          activeOpacity={0.85}
        >
          {verified ? (
            <Ionicons name="checkmark-circle" size={22} color="#fff" />
          ) : (
            <Text style={styles.confirmButtonText}>
              {loading ? 'Verifying…' : 'Confirm Age'}
            </Text>
          )}
        </TouchableOpacity>

        {/* Legal disclaimer */}
        <Text style={styles.legal}>
          Age verification is required by law for prize competitions.{'\n'}
          Your date of birth is stored securely and never shared.
        </Text>

        {/* Skip for free competitions */}
        <TouchableOpacity
          style={styles.skipButton}
          onPress={() => router.replace('/(tabs)')}
        >
          <Text style={styles.skipText}>Continue without verifying (free competitions only)</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 60,
    alignItems: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: Spacing.xxxl ?? 48,
  },
  iconContainer: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: (Colors.primary ?? '#6366F1') + '18',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  wordmark: {
    fontSize: 14,
    fontWeight: '900',
    color: Colors.textMuted ?? '#666',
    letterSpacing: 6,
    marginBottom: Spacing.xl,
  },
  headline: {
    fontSize: FontSize.xxl ?? 24,
    fontWeight: '800',
    color: Colors.textPrimary ?? '#fff',
    textAlign: 'center',
    marginBottom: Spacing.md,
  },
  subtitle: {
    fontSize: FontSize.sm ?? 14,
    color: Colors.textSecondary ?? '#aaa',
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 300,
  },
  pickerSection: {
    width: '100%',
    marginBottom: Spacing.xxl ?? 32,
  },
  pickerLabel: {
    fontSize: FontSize.sm ?? 14,
    fontWeight: '700',
    color: Colors.textSecondary ?? '#aaa',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: Spacing.md,
    textAlign: 'center',
  },
  pickerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.sm ?? 8,
    backgroundColor: Colors.surface ?? '#1a1a1a',
    borderRadius: BorderRadius.xl ?? 16,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border ?? '#333',
  },
  pickerColumn: {
    alignItems: 'center',
  },
  pickerColumnLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textMuted ?? '#666',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  pickerWrapper: {
    height: 132,
    overflow: 'hidden',
    borderRadius: BorderRadius.md ?? 8,
  },
  picker: {
    flexGrow: 0,
  },
  pickerItem: {
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: BorderRadius.sm ?? 6,
  },
  pickerItemSelected: {
    backgroundColor: (Colors.primary ?? '#6366F1') + '20',
  },
  pickerItemText: {
    fontSize: FontSize.sm ?? 14,
    color: Colors.textSecondary ?? '#aaa',
    fontWeight: '500',
  },
  pickerItemTextSelected: {
    color: Colors.primary ?? '#6366F1',
    fontWeight: '700',
    fontSize: FontSize.md ?? 16,
  },
  pickerHighlight: {
    position: 'absolute',
    top: 44,
    left: 0,
    right: 0,
    height: 44,
    borderRadius: BorderRadius.sm ?? 6,
    borderWidth: 1,
    borderColor: (Colors.primary ?? '#6366F1') + '30',
    pointerEvents: 'none',
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs ?? 4,
    backgroundColor: '#FF4D4D18',
    borderRadius: BorderRadius.lg ?? 12,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: '#FF4D4D40',
    width: '100%',
  },
  errorText: {
    flex: 1,
    fontSize: FontSize.sm ?? 14,
    color: '#FF4D4D',
    fontWeight: '500',
  },
  successBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs ?? 4,
    backgroundColor: '#22C55E18',
    borderRadius: BorderRadius.lg ?? 12,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: '#22C55E40',
    width: '100%',
  },
  successText: {
    fontSize: FontSize.sm ?? 14,
    color: '#22C55E',
    fontWeight: '600',
  },
  confirmButton: {
    width: '100%',
    backgroundColor: Colors.primary ?? '#6366F1',
    paddingVertical: Spacing.lg ?? 16,
    borderRadius: BorderRadius.lg ?? 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xl,
    ...(Shadow?.md ?? {}),
  },
  confirmButtonText: {
    color: '#fff',
    fontSize: FontSize.md ?? 16,
    fontWeight: '700',
  },
  legal: {
    fontSize: 11,
    color: Colors.textMuted ?? '#555',
    textAlign: 'center',
    lineHeight: 17,
    marginBottom: Spacing.xl,
  },
  skipButton: {
    paddingVertical: Spacing.md,
  },
  skipText: {
    fontSize: FontSize.sm ?? 13,
    color: Colors.textMuted ?? '#555',
    textDecorationLine: 'underline',
    textAlign: 'center',
  },
});
