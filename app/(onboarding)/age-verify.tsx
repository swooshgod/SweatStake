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
import { Spacing, BorderRadius, FontSize } from '@/constants/theme';
import { useTheme } from '@/contexts/ThemeContext';
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
  const { Colors, Shadow } = useTheme();
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
    <View style={[styles.container, { backgroundColor: Colors.background }]}>
      <StatusBar barStyle="light-content" />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={[styles.iconContainer, { backgroundColor: Colors.primary + '18' }]}>
            <Ionicons name="shield-checkmark" size={36} color={Colors.primary} />
          </View>
          <Text style={[styles.wordmark, { color: Colors.textMuted }]}>PODIUM</Text>
          <Text style={[styles.headline, { color: Colors.textPrimary }]}>Age Verification</Text>
          <Text style={[styles.subtitle, { color: Colors.textSecondary }]}>
            You must be {MIN_AGE} or older to enter paid competitions.
            Enter your date of birth to continue.
          </Text>
        </View>

        {/* Date pickers */}
        <View style={styles.pickerSection}>
          <Text style={[styles.pickerLabel, { color: Colors.textSecondary }]}>Date of Birth</Text>
          <View style={[styles.pickerRow, { backgroundColor: Colors.surface, borderColor: Colors.border }]}>
            {/* Month */}
            <View style={styles.pickerColumn}>
              <Text style={[styles.pickerColumnLabel, { color: Colors.textMuted }]}>Month</Text>
              <View style={styles.pickerWrapper}>
                <ScrollPicker
                  items={MONTHS}
                  selectedIndex={monthIndex}
                  onSelect={setMonthIndex}
                  width={120}
                />
                <View style={[styles.pickerHighlight, { borderColor: Colors.primary + '30', pointerEvents: 'none' }]} />
              </View>
            </View>

            {/* Day */}
            <View style={styles.pickerColumn}>
              <Text style={[styles.pickerColumnLabel, { color: Colors.textMuted }]}>Day</Text>
              <View style={styles.pickerWrapper}>
                <ScrollPicker
                  items={DAYS}
                  selectedIndex={dayIndex}
                  onSelect={setDayIndex}
                  width={64}
                />
                <View style={[styles.pickerHighlight, { borderColor: Colors.primary + '30', pointerEvents: 'none' }]} />
              </View>
            </View>

            {/* Year */}
            <View style={styles.pickerColumn}>
              <Text style={[styles.pickerColumnLabel, { color: Colors.textMuted }]}>Year</Text>
              <View style={styles.pickerWrapper}>
                <ScrollPicker
                  items={YEARS}
                  selectedIndex={yearIndex}
                  onSelect={setYearIndex}
                  width={80}
                />
                <View style={[styles.pickerHighlight, { borderColor: Colors.primary + '30', pointerEvents: 'none' }]} />
              </View>
            </View>
          </View>
        </View>

        {/* Error */}
        {error && (
          <View style={[styles.errorBox, { backgroundColor: Colors.error + '18', borderColor: Colors.error + '40' }]}>
            <Ionicons name="alert-circle" size={18} color={Colors.error} />
            <Text style={[styles.errorText, { color: Colors.error }]}>{error}</Text>
          </View>
        )}

        {/* Success */}
        {verified && (
          <View style={[styles.successBox, { backgroundColor: Colors.success + '18', borderColor: Colors.success + '40' }]}>
            <Ionicons name="checkmark-circle" size={18} color={Colors.success} />
            <Text style={[styles.successText, { color: Colors.success }]}>Verified! Taking you in…</Text>
          </View>
        )}

        {/* Confirm button */}
        <TouchableOpacity
          style={[styles.confirmButton, { backgroundColor: Colors.primary, ...Shadow.md }, (loading || verified) && { opacity: 0.6 }]}
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
        <Text style={[styles.legal, { color: Colors.textMuted }]}>
          Age verification is required by law for prize competitions.{'\n'}
          Your date of birth is stored securely and never shared.
        </Text>

        {/* Skip for free competitions */}
        <TouchableOpacity
          style={styles.skipButton}
          onPress={() => router.replace('/(tabs)')}
        >
          <Text style={[styles.skipText, { color: Colors.textMuted }]}>Continue without verifying (free competitions only)</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 60,
    alignItems: 'center',
  },
  header: { alignItems: 'center', marginBottom: Spacing.xxxl },
  iconContainer: {
    width: 72, height: 72, borderRadius: 36,
    justifyContent: 'center', alignItems: 'center', marginBottom: Spacing.md,
  },
  wordmark: { fontSize: 14, fontWeight: '900', letterSpacing: 6, marginBottom: Spacing.xl },
  headline: { fontSize: FontSize.xxl, fontWeight: '800', textAlign: 'center', marginBottom: Spacing.md },
  subtitle: { fontSize: FontSize.sm, textAlign: 'center', lineHeight: 22, maxWidth: 300 },
  pickerSection: { width: '100%', marginBottom: Spacing.xxl },
  pickerLabel: {
    fontSize: FontSize.sm, fontWeight: '700', textTransform: 'uppercase',
    letterSpacing: 0.5, marginBottom: Spacing.md, textAlign: 'center',
  },
  pickerRow: {
    flexDirection: 'row', justifyContent: 'center', gap: Spacing.sm,
    borderRadius: BorderRadius.xl, padding: Spacing.md, borderWidth: 1,
  },
  pickerColumn: { alignItems: 'center' },
  pickerColumnLabel: {
    fontSize: 11, fontWeight: '600', textTransform: 'uppercase',
    letterSpacing: 0.5, marginBottom: 4,
  },
  pickerWrapper: { height: 132, overflow: 'hidden', borderRadius: BorderRadius.md },
  picker: { flexGrow: 0 },
  pickerItem: { height: 44, justifyContent: 'center', alignItems: 'center', borderRadius: BorderRadius.sm },
  pickerItemSelected: {},
  pickerItemText: { fontSize: FontSize.sm, fontWeight: '500' },
  pickerItemTextSelected: { fontWeight: '700', fontSize: FontSize.md },
  pickerHighlight: {
    position: 'absolute', top: 44, left: 0, right: 0, height: 44,
    borderRadius: BorderRadius.sm, borderWidth: 1, pointerEvents: 'none',
  },
  errorBox: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.xs,
    borderRadius: BorderRadius.lg, paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg, marginBottom: Spacing.lg, borderWidth: 1, width: '100%',
  },
  errorText: { flex: 1, fontSize: FontSize.sm, fontWeight: '500' },
  successBox: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.xs,
    borderRadius: BorderRadius.lg, paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg, marginBottom: Spacing.lg, borderWidth: 1, width: '100%',
  },
  successText: { fontSize: FontSize.sm, fontWeight: '600' },
  confirmButton: {
    width: '100%', paddingVertical: Spacing.lg, borderRadius: BorderRadius.lg,
    alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.xl,
  },
  confirmButtonText: { color: '#fff', fontSize: FontSize.md, fontWeight: '700' },
  legal: { fontSize: 11, textAlign: 'center', lineHeight: 17, marginBottom: Spacing.xl },
  skipButton: { paddingVertical: Spacing.md },
  skipText: { fontSize: FontSize.sm, textDecorationLine: 'underline', textAlign: 'center' },
});
