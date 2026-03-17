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
import { Spacing, BorderRadius, FontSize } from '@/constants/theme';
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
        <Animated.View style={[styles.sheet, { opacity: fadeAnim, backgroundColor: Colors.surface, ...Shadow.lg }]}>
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
    backgroundColor: Colors.surface,
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
    backgroundColor: Colors.border,
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
    color: Colors.textPrimary,
  },
  subtitle: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  name: {
    color: Colors.primary,
    fontWeight: '700',
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.surfaceLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  anonNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    backgroundColor: '#22C55E10',
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.xl,
    borderWidth: 1,
    borderColor: '#22C55E20',
  },
  anonText: {
    fontSize: FontSize.xs,
    color: Colors.success,
    fontWeight: '500',
  },
  sectionLabel: {
    fontSize: FontSize.xs,
    fontWeight: '700',
    color: Colors.textMuted,
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
    borderColor: Colors.border,
    backgroundColor: Colors.background,
    marginBottom: Spacing.sm,
  },
  reasonOptionSelected: {
    borderColor: Colors.error + '60',
    backgroundColor: Colors.error + '08',
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: Colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioSelected: {
    borderColor: Colors.error,
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.error,
  },
  reasonText: {
    flex: 1,
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  reasonTextSelected: {
    color: Colors.textPrimary,
    fontWeight: '600',
  },
  detailsInput: {
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    fontSize: FontSize.sm,
    color: Colors.textPrimary,
    textAlignVertical: 'top',
    minHeight: 80,
    marginBottom: Spacing.xl,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    backgroundColor: Colors.error + '18',
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
  },
  errorText: {
    fontSize: FontSize.sm,
    color: Colors.error,
    fontWeight: '500',
    flex: 1,
  },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.error,
    paddingVertical: Spacing.lg,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.md,
    ...Shadow.md,
  },
  submitText: {
    color: Colors.background,
    fontSize: FontSize.md,
    fontWeight: '800',
  },
  fairnessNote: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 17,
    marginBottom: Spacing.md,
  },
  alreadyReported: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.surfaceLight,
    borderRadius: BorderRadius.lg,
    padding: Spacing.xl,
    marginVertical: Spacing.xl,
  },
  alreadyReportedText: {
    flex: 1,
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
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
    color: Colors.textPrimary,
  },
  successSub: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 280,
  },
});
