import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  Colors,
  Spacing,
  BorderRadius,
  FontSize,
  Shadow,
  CompetitionTypes,
  ScoringTemplates,
} from '@/constants/theme';
import { formatCents } from '@/lib/stripe';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import type { CompetitionType, ScoringCategory, CreateCompetitionForm } from '@/lib/types';

const STEPS = ['Details', 'Scoring', 'Rules', 'Review'] as const;

export default function CreateCompetitionScreen() {
  const router = useRouter();
  const { profile } = useAuth();
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState<CreateCompetitionForm>({
    name: '',
    description: '',
    type: 'fitness',
    scoringTemplate: 'full_challenge',
    categories: [...ScoringTemplates.full_challenge.categories],
    startDate: new Date(),
    endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
    maxParticipants: 20,
    entryFeeCents: 0,
    paymentType: 'stripe',
    isPublic: true,
  });

  const updateForm = useCallback(
    <K extends keyof CreateCompetitionForm>(key: K, value: CreateCompetitionForm[K]) => {
      setForm((prev) => ({ ...prev, [key]: value }));
    },
    []
  );

  const selectTemplate = useCallback((templateKey: string) => {
    const template = ScoringTemplates[templateKey as keyof typeof ScoringTemplates];
    if (template) {
      setForm((prev) => ({
        ...prev,
        scoringTemplate: templateKey,
        categories: [...template.categories],
      }));
    }
  }, []);

  const toggleCategory = useCallback((index: number) => {
    setForm((prev) => {
      const cats = [...prev.categories];
      cats.splice(index, 1);
      return { ...prev, categories: cats };
    });
  }, []);

  const updateCategoryPoints = useCallback((index: number, points: number) => {
    setForm((prev) => {
      const cats = [...prev.categories];
      cats[index] = { ...cats[index], points };
      return { ...prev, categories: cats };
    });
  }, []);

  const addCategory = useCallback(() => {
    setForm((prev) => ({
      ...prev,
      categories: [...prev.categories, { name: 'New Category', points: 1, auto_tracked: false }],
    }));
  }, []);

  const handleSubmit = async () => {
    if (!profile) {
      router.push('/(auth)/welcome');
      return;
    }

    setSubmitting(true);
    try {
      const { data, error } = await supabase
        .from('competitions')
        .insert({
          creator_id: profile.id,
          name: form.name,
          description: form.description || null,
          type: form.type,
          scoring_template: { categories: form.categories },
          start_date: form.startDate.toISOString().split('T')[0],
          end_date: form.endDate.toISOString().split('T')[0],
          max_participants: form.maxParticipants,
          entry_fee_cents: form.entryFeeCents,
          payment_type: form.paymentType,
          is_public: form.isPublic,
        })
        .select()
        .single();

      if (error) throw error;

      // Auto-join as creator
      await supabase.from('participants').insert({
        competition_id: data.id,
        user_id: profile.id,
        paid: true,
      });

      Alert.alert('Competition Created!', `Share code: ${data.invite_code}`, [
        { text: 'View', onPress: () => router.replace(`/competition/${data.id}`) },
      ]);
    } catch (error) {
      Alert.alert('Error', 'Failed to create competition. Please try again.');
      console.error(error);
    } finally {
      setSubmitting(false);
    }
  };

  const canAdvance =
    step === 0
      ? form.name.trim().length > 0
      : step === 1
        ? form.categories.length > 0
        : true;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Progress bar */}
      <View style={styles.progressBar}>
        {STEPS.map((label, i) => (
          <View key={label} style={styles.progressStep}>
            <View
              style={[
                styles.progressDot,
                i <= step && styles.progressDotActive,
                i < step && styles.progressDotComplete,
              ]}
            >
              {i < step ? (
                <Ionicons name="checkmark" size={12} color="#fff" />
              ) : (
                <Text
                  style={[styles.progressDotText, i <= step && styles.progressDotTextActive]}
                >
                  {i + 1}
                </Text>
              )}
            </View>
            <Text style={[styles.progressLabel, i <= step && styles.progressLabelActive]}>
              {label}
            </Text>
          </View>
        ))}
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Step 1: Details */}
        {step === 0 && (
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Competition Details</Text>

            <Text style={styles.inputLabel}>Name</Text>
            <TextInput
              style={styles.textInput}
              placeholder="e.g. March Madness Fitness"
              placeholderTextColor={Colors.textMuted}
              value={form.name}
              onChangeText={(t) => updateForm('name', t)}
              maxLength={50}
            />

            <Text style={styles.inputLabel}>Description (optional)</Text>
            <TextInput
              style={[styles.textInput, styles.textArea]}
              placeholder="What's this competition about?"
              placeholderTextColor={Colors.textMuted}
              value={form.description}
              onChangeText={(t) => updateForm('description', t)}
              multiline
              numberOfLines={3}
              maxLength={200}
            />

            <Text style={styles.inputLabel}>Type</Text>
            <View style={styles.typeGrid}>
              {(Object.entries(CompetitionTypes) as [CompetitionType, typeof CompetitionTypes[CompetitionType]][]).map(
                ([key, info]) => (
                  <TouchableOpacity
                    key={key}
                    style={[
                      styles.typeOption,
                      form.type === key && { borderColor: info.color, backgroundColor: info.color + '10' },
                    ]}
                    onPress={() => updateForm('type', key)}
                  >
                    <Text style={styles.typeOptionEmoji}>{info.emoji}</Text>
                    <Text
                      style={[
                        styles.typeOptionLabel,
                        form.type === key && { color: info.color },
                      ]}
                    >
                      {info.label}
                    </Text>
                  </TouchableOpacity>
                )
              )}
            </View>
          </View>
        )}

        {/* Step 2: Scoring */}
        {step === 1 && (
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Scoring Template</Text>

            {/* Template options */}
            {(Object.entries(ScoringTemplates) as [string, typeof ScoringTemplates[keyof typeof ScoringTemplates]][]).map(
              ([key, tmpl]) => (
                <TouchableOpacity
                  key={key}
                  style={[
                    styles.templateOption,
                    form.scoringTemplate === key && styles.templateOptionActive,
                  ]}
                  onPress={() => selectTemplate(key)}
                >
                  <View style={styles.templateRadio}>
                    {form.scoringTemplate === key && <View style={styles.templateRadioInner} />}
                  </View>
                  <View style={styles.templateContent}>
                    <Text style={styles.templateName}>{tmpl.name}</Text>
                    <Text style={styles.templateDesc}>{tmpl.description}</Text>
                  </View>
                </TouchableOpacity>
              )
            )}

            {/* Editable categories */}
            <Text style={[styles.inputLabel, { marginTop: Spacing.xxl }]}>
              Categories & Points
            </Text>
            {form.categories.map((cat, index) => (
              <View key={`${cat.name}-${index}`} style={styles.categoryRow}>
                <TextInput
                  style={styles.categoryName}
                  value={cat.name}
                  onChangeText={(t) => {
                    setForm((prev) => {
                      const cats = [...prev.categories];
                      cats[index] = { ...cats[index], name: t };
                      return { ...prev, categories: cats };
                    });
                  }}
                />
                <View style={styles.categoryPointsControl}>
                  <TouchableOpacity
                    onPress={() => updateCategoryPoints(index, Math.max(1, cat.points - 1))}
                    style={styles.pointsBtn}
                  >
                    <Ionicons name="remove" size={16} color={Colors.textSecondary} />
                  </TouchableOpacity>
                  <Text style={styles.categoryPoints}>{cat.points}</Text>
                  <TouchableOpacity
                    onPress={() => updateCategoryPoints(index, cat.points + 1)}
                    style={styles.pointsBtn}
                  >
                    <Ionicons name="add" size={16} color={Colors.textSecondary} />
                  </TouchableOpacity>
                </View>
                <TouchableOpacity onPress={() => toggleCategory(index)} style={styles.removeBtn}>
                  <Ionicons name="close-circle" size={22} color={Colors.error} />
                </TouchableOpacity>
              </View>
            ))}

            <TouchableOpacity style={styles.addCategoryBtn} onPress={addCategory}>
              <Ionicons name="add-circle-outline" size={20} color={Colors.primary} />
              <Text style={styles.addCategoryText}>Add Category</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Step 3: Rules */}
        {step === 2 && (
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Rules & Settings</Text>

            <Text style={styles.inputLabel}>Duration</Text>
            <View style={styles.dateRow}>
              <View style={styles.dateField}>
                <Text style={styles.dateLabel}>Start</Text>
                <Text style={styles.dateValue}>
                  {form.startDate.toLocaleDateString()}
                </Text>
              </View>
              <Ionicons name="arrow-forward" size={20} color={Colors.textMuted} />
              <View style={styles.dateField}>
                <Text style={styles.dateLabel}>End</Text>
                <Text style={styles.dateValue}>
                  {form.endDate.toLocaleDateString()}
                </Text>
              </View>
            </View>

            <Text style={styles.inputLabel}>Max Participants</Text>
            <View style={styles.counterRow}>
              <TouchableOpacity
                style={styles.counterBtn}
                onPress={() => updateForm('maxParticipants', Math.max(2, form.maxParticipants - 5))}
              >
                <Ionicons name="remove" size={20} color={Colors.textSecondary} />
              </TouchableOpacity>
              <Text style={styles.counterValue}>{form.maxParticipants}</Text>
              <TouchableOpacity
                style={styles.counterBtn}
                onPress={() => updateForm('maxParticipants', Math.min(100, form.maxParticipants + 5))}
              >
                <Ionicons name="add" size={20} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <Text style={styles.inputLabel}>Entry Fee</Text>
            <View style={styles.feeOptions}>
              {[0, 500, 1000, 2000, 5000].map((cents) => (
                <TouchableOpacity
                  key={cents}
                  style={[
                    styles.feeOption,
                    form.entryFeeCents === cents && styles.feeOptionActive,
                  ]}
                  onPress={() => updateForm('entryFeeCents', cents)}
                >
                  <Text
                    style={[
                      styles.feeOptionText,
                      form.entryFeeCents === cents && styles.feeOptionTextActive,
                    ]}
                  >
                    {formatCents(cents)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {form.entryFeeCents > 0 && (
              <>
                <Text style={styles.inputLabel}>Payment Method</Text>
                <View style={styles.paymentToggle}>
                  <TouchableOpacity
                    style={[
                      styles.paymentOption,
                      form.paymentType === 'stripe' && styles.paymentOptionActive,
                    ]}
                    onPress={() => updateForm('paymentType', 'stripe')}
                  >
                    <Ionicons name="card" size={18} color={form.paymentType === 'stripe' ? '#fff' : Colors.textSecondary} />
                    <Text style={[styles.paymentOptionText, form.paymentType === 'stripe' && styles.paymentOptionTextActive]}>
                      Stripe
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.paymentOption,
                      form.paymentType === 'usdc' && styles.paymentOptionActive,
                    ]}
                    onPress={() => updateForm('paymentType', 'usdc')}
                  >
                    <Ionicons name="wallet" size={18} color={form.paymentType === 'usdc' ? '#fff' : Colors.textSecondary} />
                    <Text style={[styles.paymentOptionText, form.paymentType === 'usdc' && styles.paymentOptionTextActive]}>
                      USDC
                    </Text>
                  </TouchableOpacity>
                </View>
              </>
            )}

            <Text style={styles.inputLabel}>Visibility</Text>
            <View style={styles.paymentToggle}>
              <TouchableOpacity
                style={[styles.paymentOption, form.isPublic && styles.paymentOptionActive]}
                onPress={() => updateForm('isPublic', true)}
              >
                <Ionicons name="globe" size={18} color={form.isPublic ? '#fff' : Colors.textSecondary} />
                <Text style={[styles.paymentOptionText, form.isPublic && styles.paymentOptionTextActive]}>
                  Public
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.paymentOption, !form.isPublic && styles.paymentOptionActive]}
                onPress={() => updateForm('isPublic', false)}
              >
                <Ionicons name="lock-closed" size={18} color={!form.isPublic ? '#fff' : Colors.textSecondary} />
                <Text style={[styles.paymentOptionText, !form.isPublic && styles.paymentOptionTextActive]}>
                  Invite Only
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Step 4: Review */}
        {step === 3 && (
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Review & Launch</Text>

            <View style={styles.reviewCard}>
              <View style={styles.reviewRow}>
                <Text style={styles.reviewLabel}>Name</Text>
                <Text style={styles.reviewValue}>{form.name}</Text>
              </View>
              <View style={styles.reviewRow}>
                <Text style={styles.reviewLabel}>Type</Text>
                <Text style={styles.reviewValue}>
                  {CompetitionTypes[form.type].emoji} {CompetitionTypes[form.type].label}
                </Text>
              </View>
              <View style={styles.reviewRow}>
                <Text style={styles.reviewLabel}>Duration</Text>
                <Text style={styles.reviewValue}>
                  {form.startDate.toLocaleDateString()} — {form.endDate.toLocaleDateString()}
                </Text>
              </View>
              <View style={styles.reviewRow}>
                <Text style={styles.reviewLabel}>Max Players</Text>
                <Text style={styles.reviewValue}>{form.maxParticipants}</Text>
              </View>
              <View style={styles.reviewRow}>
                <Text style={styles.reviewLabel}>Entry Fee</Text>
                <Text style={styles.reviewValue}>{formatCents(form.entryFeeCents)}</Text>
              </View>
              <View style={styles.reviewRow}>
                <Text style={styles.reviewLabel}>Categories</Text>
                <Text style={styles.reviewValue}>{form.categories.length}</Text>
              </View>
              <View style={styles.reviewRow}>
                <Text style={styles.reviewLabel}>Visibility</Text>
                <Text style={styles.reviewValue}>{form.isPublic ? 'Public' : 'Invite Only'}</Text>
              </View>
            </View>

            {form.entryFeeCents > 0 && (
              <View style={styles.paymentNotice}>
                <Ionicons name="information-circle" size={20} color={Colors.warning} />
                <Text style={styles.paymentNoticeText}>
                  You'll pay {formatCents(form.entryFeeCents)} to activate this competition.
                  Entry fees are held in escrow until the competition ends.
                </Text>
              </View>
            )}
          </View>
        )}
      </ScrollView>

      {/* Bottom navigation */}
      <View style={styles.bottomBar}>
        {step > 0 && (
          <TouchableOpacity style={styles.backButton} onPress={() => setStep(step - 1)}>
            <Ionicons name="arrow-back" size={20} color={Colors.textSecondary} />
            <Text style={styles.backButtonText}>Back</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={[
            styles.nextButton,
            !canAdvance && styles.nextButtonDisabled,
            step === 3 && styles.launchButton,
          ]}
          disabled={!canAdvance || submitting}
          onPress={() => {
            if (step < 3) setStep(step + 1);
            else handleSubmit();
          }}
        >
          <Text style={[styles.nextButtonText, step === 3 && styles.launchButtonText]}>
            {step === 3 ? (submitting ? 'Creating...' : 'Launch Competition') : 'Continue'}
          </Text>
          {step < 3 && <Ionicons name="arrow-forward" size={18} color="#fff" />}
          {step === 3 && !submitting && <Ionicons name="rocket" size={18} color="#fff" />}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  progressBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.xxl,
    paddingVertical: Spacing.lg,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  progressStep: {
    alignItems: 'center',
    flex: 1,
  },
  progressDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.borderLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  progressDotActive: {
    backgroundColor: Colors.primary,
  },
  progressDotComplete: {
    backgroundColor: Colors.success,
  },
  progressDotText: {
    fontSize: FontSize.xs,
    fontWeight: '700',
    color: Colors.textMuted,
  },
  progressDotTextActive: {
    color: '#fff',
  },
  progressLabel: {
    fontSize: FontSize.xs,
    fontWeight: '600',
    color: Colors.textMuted,
  },
  progressLabelActive: {
    color: Colors.textPrimary,
  },
  scrollContent: {
    padding: Spacing.lg,
    paddingBottom: 120,
  },
  stepContent: {},
  stepTitle: {
    fontSize: FontSize.xxl,
    fontWeight: '800',
    color: Colors.textPrimary,
    marginBottom: Spacing.xxl,
  },
  inputLabel: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: Spacing.sm,
    marginTop: Spacing.lg,
  },
  textInput: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    fontSize: FontSize.md,
    color: Colors.textPrimary,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  typeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  typeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    gap: Spacing.sm,
  },
  typeOptionEmoji: {
    fontSize: FontSize.lg,
  },
  typeOptionLabel: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  templateOption: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    marginBottom: Spacing.sm,
  },
  templateOptionActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primary + '08',
  },
  templateRadio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: Colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
    marginTop: 2,
  },
  templateRadioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: Colors.primary,
  },
  templateContent: {
    flex: 1,
  },
  templateName: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  templateDesc: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  categoryName: {
    flex: 1,
    fontSize: FontSize.md,
    color: Colors.textPrimary,
  },
  categoryPointsControl: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  pointsBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.borderLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  categoryPoints: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.primary,
    minWidth: 20,
    textAlign: 'center',
  },
  removeBtn: {
    marginLeft: Spacing.sm,
  },
  addCategoryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    gap: Spacing.sm,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    borderColor: Colors.primary + '30',
    borderStyle: 'dashed',
  },
  addCategoryText: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.primary,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  dateField: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
  },
  dateLabel: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    marginBottom: Spacing.xs,
  },
  dateValue: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  counterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xxl,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  counterBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.borderLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  counterValue: {
    fontSize: FontSize.xxl,
    fontWeight: '800',
    color: Colors.textPrimary,
    minWidth: 50,
    textAlign: 'center',
  },
  feeOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  feeOption: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  feeOptionActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primary + '10',
  },
  feeOptionText: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  feeOptionTextActive: {
    color: Colors.primary,
  },
  paymentToggle: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  paymentOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  paymentOptionActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primary,
  },
  paymentOptionText: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  paymentOptionTextActive: {
    color: '#fff',
  },
  reviewCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    ...Shadow.md,
  },
  reviewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  reviewLabel: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
  },
  reviewValue: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  paymentNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    marginTop: Spacing.lg,
    padding: Spacing.lg,
    backgroundColor: Colors.warning + '12',
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.warning + '30',
  },
  paymentNoticeText: {
    flex: 1,
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.lg,
    paddingBottom: 34,
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
    gap: Spacing.md,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
  },
  backButtonText: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  nextButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.primary,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    ...Shadow.md,
  },
  nextButtonDisabled: {
    backgroundColor: Colors.textMuted,
    opacity: 0.5,
  },
  nextButtonText: {
    color: '#fff',
    fontSize: FontSize.md,
    fontWeight: '700',
  },
  launchButton: {
    backgroundColor: Colors.success,
  },
  launchButtonText: {
    color: '#fff',
  },
});
