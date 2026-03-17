/**
 * Podium — Report User Modal
 * Allows competitors to flag suspicious activity.
 * Reports are anonymous and reviewed by the trust system.
 */

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  ScrollView,
  Animated,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Spacing, BorderRadius, FontSize, Shadow } from '@/constants/theme';
import { useTheme } from '@/contexts/ThemeContext';
import {
  submitReport,
  hasAlreadyReported,
  REPORT_REASONS,
  type ReportReason,
} from '@/lib/trust';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ReportUserModalProps {
  visible: boolean;
  onClose: () => void;
  reportedUserId: string;
  reportedDisplayName: string;
  competitionId: string;
  currentUserId: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ReportUserModal({
  visible,
  onClose,
  reportedUserId,
  reportedDisplayName,
  competitionId,
  currentUserId,
}: ReportUserModalProps) {
  const [selectedReason, setSelectedReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [alreadyReported, setAlreadyReported] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { Colors, Shadow } = useTheme();

  const fadeAnim = React.useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      // Check if already reported
      hasAlreadyReported(currentUserId, reportedUserId, competitionId).then(
        (already) => setAlreadyReported(already)
      );
      // Fade in
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start();
    } else {
      // Reset state when closed
      setTimeout(() => {
        setSelectedReason(null);
        setDetails('');
        setSubmitted(false);
        setAlreadyReported(false);
        setError(null);
        fadeAnim.setValue(0);
      }, 300);
    }
  }, [visible]);

  const handleSubmit = async () => {
    if (!selectedReason) return;
    setSubmitting(true);
    setError(null);

    const result = await submitReport(
      currentUserId,
      reportedUserId,
      competitionId,
      selectedReason,
      details.trim() || undefined
    );

    setSubmitting(false);

    if (result.alreadyReported) {
      setAlreadyReported(true);
      return;
    }

    if (!result.success) {
      setError(result.error ?? 'Something went wrong.');
      return;
    }

    setSubmitted(true);
    setTimeout(onClose, 2000);
  };

  const reasons = Object.entries(REPORT_REASONS) as [ReportReason, string][];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={[styles.overlay, { backgroundColor: Colors.overlay }]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Animated.View style={[styles.sheet, { opacity: fadeAnim, backgroundColor: '#141414', ...Shadow.lg }]}>
          {/* Handle */}
          <View style={[styles.handle, { backgroundColor: Colors.border }]} />

          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={[styles.title, { color: Colors.textPrimary }]}>Report Competitor</Text>
              <Text style={[styles.subtitle, { color: Colors.textSecondary }]}>
                Reporting <Text style={[styles.name, { color: Colors.primary }]}>{reportedDisplayName}</Text>
              </Text>
            </View>
            <TouchableOpacity style={[styles.closeBtn, { backgroundColor: Colors.surfaceLight }]} onPress={onClose}>
              <Ionicons name="close" size={20} color={Colors.textMuted} />
            </TouchableOpacity>
          </View>

          {/* Anonymous notice */}
          <View style={[styles.anonNotice, { backgroundColor: Colors.success + '10', borderColor: Colors.success + '20' }]}>
            <Ionicons name="shield-checkmark" size={14} color={Colors.success} />
            <Text style={[styles.anonText, { color: Colors.success }]}>Reports are anonymous and reviewed fairly.</Text>
          </View>

          {/* Already reported state */}
          {alreadyReported && (
            <View style={styles.alreadyReported}>
              <Ionicons name="checkmark-circle" size={18} color={Colors.textMuted} />
              <Text style={styles.alreadyReportedText}>
                You've already reported this competitor in this competition.
              </Text>
            </View>
          )}

          {/* Success state */}
          {submitted && (
            <View style={styles.successBox}>
              <Ionicons name="checkmark-circle" size={32} color={Colors.success} />
              <Text style={styles.successTitle}>Report Submitted</Text>
              <Text style={styles.successSub}>
                Thank you for keeping Podium fair. We'll review this.
              </Text>
            </View>
          )}

          {/* Form */}
          {!submitted && !alreadyReported && (
            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              <Text style={styles.sectionLabel}>Reason for report</Text>
              {reasons.map(([key, label]) => (
                <TouchableOpacity
                  key={key}
                  style={[
                    styles.reasonOption,
                    selectedReason === key && styles.reasonOptionSelected,
                  ]}
                  onPress={() => setSelectedReason(key)}
                  activeOpacity={0.7}
                >
                  <View style={[
                    styles.radio,
                    selectedReason === key && styles.radioSelected,
                  ]}>
                    {selectedReason === key && <View style={styles.radioDot} />}
                  </View>
                  <Text style={[
                    styles.reasonText,
                    selectedReason === key && styles.reasonTextSelected,
                  ]}>
                    {label}
                  </Text>
                </TouchableOpacity>
              ))}

              <Text style={styles.sectionLabel}>
                Additional details{' '}
                <Text style={styles.optional}>(optional)</Text>
              </Text>
              <TextInput
                style={styles.detailsInput}
                value={details}
                onChangeText={setDetails}
                placeholder="Describe what you observed..."
                placeholderTextColor={Colors.textMuted}
                multiline
                numberOfLines={3}
                maxLength={300}
              />

              {error && (
                <View style={styles.errorBox}>
                  <Ionicons name="alert-circle" size={16} color={Colors.error} />
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              )}

              <TouchableOpacity
                style={[
                  styles.submitBtn,
                  (!selectedReason || submitting) && { opacity: 0.5 },
                ]}
                onPress={handleSubmit}
                disabled={!selectedReason || submitting}
                activeOpacity={0.85}
              >
                {submitting ? (
                  <ActivityIndicator color={Colors.background} />
                ) : (
                  <>
                    <Ionicons name="flag" size={18} color={Colors.background} />
                    <Text style={styles.submitText}>Submit Report</Text>
                  </>
                )}
              </TouchableOpacity>

              <Text style={styles.fairnessNote}>
                False reports may result in a reduction of your own trust score.
              </Text>
            </ScrollView>
          )}
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#141414',
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    paddingHorizontal: Spacing.xl,
    paddingBottom: 40,
    paddingTop: Spacing.md,
    maxHeight: '85%',
    ...Shadow.lg,
  },
  handle: {
    width: 36,
    height: 4,
    backgroundColor: '#242424',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: Spacing.lg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.md,
  },
  title: {
    fontSize: FontSize.xl,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  subtitle: {
    fontSize: FontSize.sm,
    color: '#A3A3A3',
    marginTop: 2,
  },
  name: {
    color: '#0057FF',
    fontWeight: '700',
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#1E1E1E',
    justifyContent: 'center',
    alignItems: 'center',
  },
  anonNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    backgroundColor: 'rgba(34,197,94,0.06)',
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.xl,
    borderWidth: 1,
    borderColor: '#22C55E20',
  },
  anonText: {
    fontSize: FontSize.xs,
    color: '#22C55E',
    fontWeight: '500',
  },
  sectionLabel: {
    fontSize: FontSize.xs,
    fontWeight: '700',
    color: '#525252',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: Spacing.md,
    marginTop: Spacing.lg,
  },
  optional: {
    fontWeight: '400',
    textTransform: 'none',
    letterSpacing: 0,
  },
  reasonOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    borderWidth: 1.5,
    borderColor: '#242424',
    backgroundColor: '#0A0A0A',
    marginBottom: Spacing.sm,
  },
  reasonOptionSelected: {
    borderColor: 'rgba(239,68,68,0.4)',
    backgroundColor: 'rgba(239,68,68,0.05)',
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#242424',
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioSelected: {
    borderColor: '#EF4444',
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#EF4444',
  },
  reasonText: {
    flex: 1,
    fontSize: FontSize.sm,
    color: '#A3A3A3',
    fontWeight: '500',
  },
  reasonTextSelected: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  detailsInput: {
    backgroundColor: '#0A0A0A',
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: '#242424',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    fontSize: FontSize.sm,
    color: '#FFFFFF',
    textAlignVertical: 'top',
    minHeight: 80,
    marginBottom: Spacing.xl,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    backgroundColor: 'rgba(239,68,68,0.1)',
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
  },
  errorText: {
    fontSize: FontSize.sm,
    color: '#EF4444',
    fontWeight: '500',
    flex: 1,
  },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: '#EF4444',
    paddingVertical: Spacing.lg,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.md,
    ...Shadow.md,
  },
  submitText: {
    color: '#0A0A0A',
    fontSize: FontSize.md,
    fontWeight: '800',
  },
  fairnessNote: {
    fontSize: FontSize.xs,
    color: '#525252',
    textAlign: 'center',
    lineHeight: 17,
    marginBottom: Spacing.md,
  },
  alreadyReported: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: '#1E1E1E',
    borderRadius: BorderRadius.lg,
    padding: Spacing.xl,
    marginVertical: Spacing.xl,
  },
  alreadyReportedText: {
    flex: 1,
    fontSize: FontSize.sm,
    color: '#A3A3A3',
    lineHeight: 20,
  },
  successBox: {
    alignItems: 'center',
    paddingVertical: Spacing.xxxl,
    gap: Spacing.md,
  },
  successTitle: {
    fontSize: FontSize.xl,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  successSub: {
    fontSize: FontSize.sm,
    color: '#A3A3A3',
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 280,
  },
});
