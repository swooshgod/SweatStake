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
  ScoringTemplates,
} from '@/constants/theme';
import { formatCents } from '@/lib/stripe';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import type { CompetitionType, CreateCompetitionForm, ScoringMode } from '@/lib/types';
import { SCORING_MODES } from '@/lib/types';

const COMP_TYPES = [
  { id: 'step_race', icon: '\u{1F3C3}', name: 'Step Race', desc: 'Most steps wins', watch: false, type: 'running' as CompetitionType, scoringMode: 'raw_steps' as ScoringMode },
  { id: 'weight_loss', icon: '\u{2696}\u{FE0F}', name: 'Weight Loss', desc: 'Most lbs lost wins', watch: false, type: 'fitness' as CompetitionType, scoringMode: 'weight_loss' as ScoringMode },
  { id: 'workout_streak', icon: '\u{1F4AA}', name: 'Workout Streak', desc: 'Most workouts wins', watch: true, type: 'fitness' as CompetitionType, scoringMode: 'raw_workouts' as ScoringMode },
  { id: 'calorie_burn', icon: '\u{1F525}', name: 'Calorie Burn', desc: 'Most calories wins', watch: true, type: 'fitness' as CompetitionType, scoringMode: 'raw_calories' as ScoringMode },
  { id: 'improvement', icon: '\u{1F4C8}', name: '% Improvement', desc: 'Biggest improvement wins', watch: false, type: 'fitness' as CompetitionType, scoringMode: 'relative_improvement' as ScoringMode },
];

const FEE_OPTIONS = [
  { label: 'Free', cents: 0 },
  { label: '$10', cents: 1000 },
  { label: '$25', cents: 2500 },
  { label: '$50', cents: 5000 },
  { label: '$100', cents: 10000 },
];

const DURATION_OPTIONS = [
  { label: '1 Week', days: 7 },
  { label: '2 Weeks', days: 14 },
  { label: '1 Month', days: 30 },
];

export default function CreateCompetitionScreen() {
  const router = useRouter();
  const { profile } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [customFee, setCustomFee] = useState('');
  const [selectedType, setSelectedType] = useState(COMP_TYPES[0]);
  const [selectedDuration, setSelectedDuration] = useState(DURATION_OPTIONS[2]);

  const [form, setForm] = useState<CreateCompetitionForm>({
    name: '',
    description: '',
    type: 'running',
    scoringTemplate: 'step_race',
    categories: [...ScoringTemplates.step_race.categories],
    scoringMode: 'raw_steps',
    startDate: new Date(),
    endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    maxParticipants: 20,
    entryFeeCents: 0,
    paymentType: 'stripe',
    isPublic: true,
    isPrivate: false,
    requiresWatch: false,
  });

  const updateForm = useCallback(
    <K extends keyof CreateCompetitionForm>(key: K, value: CreateCompetitionForm[K]) => {
      setForm((prev) => ({ ...prev, [key]: value }));
    },
    []
  );

  const selectCompType = useCallback((comp: typeof COMP_TYPES[number]) => {
    setSelectedType(comp);
    const scoring = ScoringTemplates[comp.id as keyof typeof ScoringTemplates];
    setForm((prev) => ({
      ...prev,
      type: comp.type,
      scoringTemplate: comp.id,
      scoringMode: comp.scoringMode,
      requiresWatch: comp.watch,
      categories: scoring ? [...scoring.categories] : prev.categories,
    }));
  }, []);

  const selectDuration = useCallback((dur: typeof DURATION_OPTIONS[number]) => {
    setSelectedDuration(dur);
    setForm((prev) => ({
      ...prev,
      endDate: new Date(prev.startDate.getTime() + dur.days * 24 * 60 * 60 * 1000),
    }));
  }, []);

  const generateName = () => {
    const month = new Date().toLocaleString('default', { month: 'long' });
    const year = new Date().getFullYear();
    return `${selectedType.name} \u{00B7} ${month} ${year}`;
  };

  const handleSubmit = async () => {
    if (!profile) {
      router.push('/(auth)/welcome?modal=1');
      return;
    }

    setSubmitting(true);
    try {
      const finalName = form.name.trim() || generateName();

      const { data, error } = await supabase
        .from('competitions')
        .insert({
          creator_id: profile.id,
          name: finalName,
          description: form.description || null,
          type: form.type,
          scoring_template: { categories: form.categories },
          scoring_mode: form.scoringMode,
          start_date: form.startDate.toISOString().split('T')[0],
          end_date: form.endDate.toISOString().split('T')[0],
          max_participants: form.maxParticipants,
          entry_fee_cents: form.entryFeeCents,
          payment_type: form.paymentType,
          is_public: form.isPublic,
          is_private: form.isPrivate,
          requires_watch: form.requiresWatch,
        })
        .select()
        .single();

      if (error) throw error;

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

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ─── Section 1: What kind of competition? ─── */}
        <Text style={styles.sectionLabel}>What kind of competition?</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.typeCarousel}
        >
          {COMP_TYPES.map((comp) => {
            const isSelected = selectedType.id === comp.id;
            return (
              <TouchableOpacity
                key={comp.id}
                style={[styles.typeCard, isSelected && styles.typeCardSelected]}
                activeOpacity={0.7}
                onPress={() => selectCompType(comp)}
              >
                <Text style={styles.typeCardIcon}>{comp.icon}</Text>
                <Text style={[styles.typeCardName, isSelected && styles.typeCardNameSelected]}>
                  {comp.name}
                </Text>
                <Text style={styles.typeCardDesc}>{comp.desc}</Text>
                {comp.watch && (
                  <Text style={styles.typeCardWatch}>{'\u{231A}'} Watch</Text>
                )}
                {!comp.watch && (
                  <Text style={styles.typeCardPhone}>{'\u{1F4F1}'} iPhone OK</Text>
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* ─── Section 2: Set the stakes ─── */}
        <Text style={styles.sectionLabel}>Set the stakes</Text>

        {/* Entry Fee */}
        <Text style={styles.fieldLabel}>Entry fee</Text>
        <View style={styles.pillRow}>
          {FEE_OPTIONS.map((opt) => {
            const isSelected = form.entryFeeCents === opt.cents && customFee === '';
            return (
              <TouchableOpacity
                key={opt.cents}
                style={[styles.pill, isSelected && styles.pillSelected]}
                onPress={() => {
                  updateForm('entryFeeCents', opt.cents);
                  setCustomFee('');
                }}
              >
                <Text style={[styles.pillText, isSelected && styles.pillTextSelected]}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            );
          })}
          <TouchableOpacity
            style={[styles.pill, customFee !== '' && styles.pillSelected]}
            onPress={() => setCustomFee(customFee || '0')}
          >
            <Text style={[styles.pillText, customFee !== '' && styles.pillTextSelected]}>
              Custom
            </Text>
          </TouchableOpacity>
        </View>
        {customFee !== '' && (
          <View style={styles.customFeeRow}>
            <Text style={styles.customFeePrefix}>$</Text>
            <TextInput
              style={styles.customFeeInput}
              value={customFee}
              onChangeText={(t) => {
                const cleaned = t.replace(/[^0-9]/g, '');
                setCustomFee(cleaned);
                updateForm('entryFeeCents', parseInt(cleaned || '0', 10) * 100);
              }}
              keyboardType="number-pad"
              placeholder="0"
              placeholderTextColor={Colors.textMuted}
              autoFocus
            />
          </View>
        )}

        {/* Duration */}
        <Text style={styles.fieldLabel}>Duration</Text>
        <View style={styles.pillRow}>
          {DURATION_OPTIONS.map((dur) => {
            const isSelected = selectedDuration.days === dur.days;
            return (
              <TouchableOpacity
                key={dur.days}
                style={[styles.pill, isSelected && styles.pillSelected]}
                onPress={() => selectDuration(dur)}
              >
                <Text style={[styles.pillText, isSelected && styles.pillTextSelected]}>
                  {dur.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Public/Private Toggle */}
        <Text style={styles.fieldLabel}>Visibility</Text>
        <View style={styles.toggleRow}>
          <TouchableOpacity
            style={[styles.toggleOption, !form.isPrivate && styles.toggleOptionActive]}
            onPress={() => setForm((prev) => {
              const needsReset = SCORING_MODES.find((m) => m.id === prev.scoringMode)?.privateOnly;
              return {
                ...prev,
                isPublic: true,
                isPrivate: false,
                scoringMode: needsReset ? 'relative_improvement' : prev.scoringMode,
              };
            })}
          >
            <Text style={[styles.toggleText, !form.isPrivate && styles.toggleTextActive]}>
              Public
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleOption, form.isPrivate && styles.toggleOptionActive]}
            onPress={() => setForm((prev) => ({ ...prev, isPublic: false, isPrivate: true }))}
          >
            <Text style={[styles.toggleText, form.isPrivate && styles.toggleTextActive]}>
              Private
            </Text>
          </TouchableOpacity>
        </View>

        {/* Competition Name (optional) */}
        <Text style={styles.fieldLabel}>Competition name <Text style={styles.optionalTag}>optional</Text></Text>
        <TextInput
          style={styles.textInput}
          placeholder={generateName()}
          placeholderTextColor={Colors.textMuted}
          value={form.name}
          onChangeText={(t) => updateForm('name', t)}
          maxLength={50}
        />

        {/* ─── Section 3: Advanced (collapsed) ─── */}
        <TouchableOpacity
          style={styles.advancedToggle}
          onPress={() => setAdvancedOpen(!advancedOpen)}
          activeOpacity={0.7}
        >
          <Text style={styles.advancedToggleText}>Advanced</Text>
          <Ionicons
            name={advancedOpen ? 'chevron-up' : 'chevron-down'}
            size={18}
            color={Colors.textMuted}
          />
        </TouchableOpacity>

        {advancedOpen && (
          <View style={styles.advancedSection}>
            {/* Max Participants */}
            <Text style={styles.fieldLabel}>Max participants</Text>
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

            {/* Scoring Mode */}
            <Text style={styles.fieldLabel}>Scoring mode</Text>
            {SCORING_MODES.map((mode) => {
              const isSelected = form.scoringMode === mode.id;
              const isLocked = mode.privateOnly && !form.isPrivate;
              return (
                <TouchableOpacity
                  key={mode.id}
                  style={[
                    styles.scoringOption,
                    isSelected && styles.scoringOptionSelected,
                    isLocked && { opacity: 0.4 },
                  ]}
                  onPress={() => {
                    if (!isLocked) updateForm('scoringMode', mode.id);
                    else Alert.alert('Private Only', 'Switch to Private to unlock this scoring mode.');
                  }}
                >
                  <Text style={[styles.scoringName, isSelected && { color: Colors.primary }]}>
                    {mode.label}
                  </Text>
                  <Text style={styles.scoringDesc}>{mode.description}</Text>
                </TouchableOpacity>
              );
            })}

            {/* Payment Method */}
            {form.entryFeeCents > 0 && (
              <>
                <Text style={styles.fieldLabel}>Payment method</Text>
                <View style={styles.toggleRow}>
                  <TouchableOpacity
                    style={[styles.toggleOption, form.paymentType === 'stripe' && styles.toggleOptionActive]}
                    onPress={() => updateForm('paymentType', 'stripe')}
                  >
                    <Ionicons name="card" size={16} color={form.paymentType === 'stripe' ? '#fff' : Colors.textSecondary} />
                    <Text style={[styles.toggleText, form.paymentType === 'stripe' && styles.toggleTextActive]}>Stripe</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.toggleOption, form.paymentType === 'usdc' && styles.toggleOptionActive]}
                    onPress={() => updateForm('paymentType', 'usdc')}
                  >
                    <Ionicons name="wallet" size={16} color={form.paymentType === 'usdc' ? '#fff' : Colors.textSecondary} />
                    <Text style={[styles.toggleText, form.paymentType === 'usdc' && styles.toggleTextActive]}>USDC</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}

            {/* Description */}
            <Text style={styles.fieldLabel}>Description <Text style={styles.optionalTag}>optional</Text></Text>
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
          </View>
        )}
      </ScrollView>

      {/* Bottom CTA */}
      <View style={styles.bottomBar}>
        {form.entryFeeCents > 0 && (
          <Text style={styles.feePreview}>
            {formatCents(form.entryFeeCents)} entry
          </Text>
        )}
        <TouchableOpacity
          style={[styles.createButton, submitting && { opacity: 0.6 }]}
          disabled={submitting}
          onPress={handleSubmit}
          activeOpacity={0.85}
        >
          <Text style={styles.createButtonText}>
            {submitting ? 'Creating...' : 'Create Competition'}
          </Text>
          {!submitting && <Ionicons name="arrow-forward" size={18} color="#fff" />}
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
  scrollContent: {
    padding: Spacing.lg,
    paddingBottom: 120,
  },
  sectionLabel: {
    fontSize: FontSize.xl,
    fontWeight: '800',
    color: Colors.textPrimary,
    marginBottom: Spacing.lg,
    marginTop: Spacing.lg,
  },
  typeCarousel: {
    paddingRight: Spacing.lg,
    gap: Spacing.sm,
    paddingBottom: Spacing.sm,
  },
  typeCard: {
    width: 140,
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    gap: 4,
  },
  typeCardSelected: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primary + '12',
  },
  typeCardIcon: {
    fontSize: 28,
    marginBottom: 4,
  },
  typeCardName: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  typeCardNameSelected: {
    color: Colors.primary,
  },
  typeCardDesc: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    lineHeight: 15,
  },
  typeCardWatch: {
    fontSize: FontSize.xs,
    color: Colors.warning,
    fontWeight: '600',
    marginTop: 4,
  },
  typeCardPhone: {
    fontSize: FontSize.xs,
    color: Colors.success,
    fontWeight: '600',
    marginTop: 4,
  },
  fieldLabel: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: Spacing.sm,
    marginTop: Spacing.xl,
  },
  optionalTag: {
    fontWeight: '400',
    textTransform: 'none',
    letterSpacing: 0,
    color: Colors.textMuted,
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  pill: {
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.full,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  pillSelected: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primary + '18',
  },
  pillText: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  pillTextSelected: {
    color: Colors.primary,
  },
  customFeeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.sm,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.lg,
  },
  customFeePrefix: {
    fontSize: FontSize.xl,
    fontWeight: '700',
    color: Colors.primary,
  },
  customFeeInput: {
    flex: 1,
    fontSize: FontSize.xl,
    fontWeight: '700',
    color: Colors.textPrimary,
    paddingVertical: Spacing.md,
    paddingLeft: Spacing.xs,
  },
  toggleRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  toggleOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  toggleOptionActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primary,
  },
  toggleText: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  toggleTextActive: {
    color: '#fff',
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
  advancedToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.lg,
    marginTop: Spacing.xxl,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  advancedToggleText: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.textMuted,
  },
  advancedSection: {
    paddingBottom: Spacing.lg,
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
    backgroundColor: Colors.surfaceLight,
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
  scoringOption: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    marginBottom: Spacing.sm,
  },
  scoringOptionSelected: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primary + '08',
  },
  scoringName: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 2,
  },
  scoringDesc: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.lg,
    paddingBottom: 34,
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    gap: Spacing.md,
  },
  feePreview: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.primary,
  },
  createButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.primary,
    paddingVertical: Spacing.lg,
    borderRadius: BorderRadius.lg,
    ...Shadow.md,
  },
  createButtonText: {
    color: '#fff',
    fontSize: FontSize.md,
    fontWeight: '700',
  },
});
