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
  Spacing,
  BorderRadius,
  FontSize,
  ScoringTemplates,
} from '@/constants/theme';
import { useTheme } from '@/contexts/ThemeContext';
import { formatCents } from '@/lib/stripe';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import type { CompetitionType, CreateCompetitionForm, ScoringMode, TierLockMode } from '@/lib/types';
import { SCORING_MODES } from '@/lib/types';
import { TIER_LOCK_OPTIONS, FITNESS_TIERS, getTierFromSteps, getUserBaseline } from '@/lib/healthkit';

const MIN_PARTICIPANTS = 3; // Competition won't activate below this

const COMP_TYPES = [
  { id: 'step_race',      icon: '🏃', name: 'Step Race',       desc: 'Most steps wins — auto-tracked',          watch: false, type: 'running' as CompetitionType, scoringMode: 'raw_steps' as ScoringMode },
  { id: 'improvement',   icon: '📈', name: '% Improvement',   desc: 'Biggest improvement above your baseline', watch: false, type: 'fitness' as CompetitionType, scoringMode: 'relative_improvement' as ScoringMode },
  { id: 'weight_loss',   icon: '⚖️', name: 'Weight Loss %',   desc: 'Most % body weight lost — manual weigh-ins', watch: false, type: 'fitness' as CompetitionType, scoringMode: 'raw_weight_loss_pct' as ScoringMode },
  { id: 'distance',      icon: '🗺️', name: 'Distance Race',   desc: 'Most miles/km — auto-tracked via GPS',    watch: false, type: 'running' as CompetitionType, scoringMode: 'raw_miles' as ScoringMode },
  { id: 'active_minutes',icon: '🧘', name: 'Active Minutes',  desc: 'Most minutes of any exercise',            watch: false, type: 'fitness' as CompetitionType, scoringMode: 'raw_active_minutes' as ScoringMode },
  { id: 'full_challenge', icon: '🏆', name: 'Full Challenge',  desc: 'Steps + Distance + Active Minutes',       watch: false, type: 'fitness' as CompetitionType, scoringMode: 'raw_steps' as ScoringMode },
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
  const { Colors, Shadow } = useTheme();
  const [submitting, setSubmitting] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [creatorTier, setCreatorTier] = useState<string | null>(null);
  const [tierLock, setTierLock] = useState<TierLockMode>('none');

  // Calculate creator's fitness tier on mount
  React.useEffect(() => {
    getUserBaseline().then((baseline) => {
      if (baseline) {
        const tier = getTierFromSteps(baseline.avgDailySteps);
        setCreatorTier(tier);
      }
    });
  }, []);
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
    allowBeforePhoto: true,
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
      // Validate minimum participants for paid competitions
      if (form.entryFeeCents > 0 && form.maxParticipants < MIN_PARTICIPANTS) {
        Alert.alert('Minimum 3 Players', 'Paid competitions need at least 3 participants to run.');
        setSubmitting(false);
        return;
      }

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
          allow_before_photo: selectedDuration.days >= 14 ? form.allowBeforePhoto : false,
          creator_tier: creatorTier,
          tier_lock: tierLock,
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

  const dynamicStyles = {
    container: { backgroundColor: Colors.background },
    sectionLabel: { color: Colors.textPrimary },
    typeCard: { borderColor: Colors.border, backgroundColor: Colors.surface },
    typeCardSelected: { borderColor: Colors.primary, backgroundColor: Colors.primary + '12' },
    typeCardName: { color: Colors.textPrimary },
    typeCardNameSelected: { color: Colors.primary },
    typeCardDesc: { color: Colors.textSecondary },
    typeCardWatch: { color: Colors.warning },
    typeCardPhone: { color: Colors.success },
    fieldLabel: { color: Colors.textSecondary },
    optionalTag: { color: Colors.textMuted },
    pill: { borderColor: Colors.border, backgroundColor: Colors.surface },
    pillSelected: { borderColor: Colors.primary, backgroundColor: Colors.primary + '18' },
    pillText: { color: Colors.textSecondary },
    pillTextSelected: { color: Colors.primary },
    customFeeRow: { backgroundColor: Colors.surface, borderColor: Colors.border },
    customFeePrefix: { color: Colors.primary },
    customFeeInput: { color: Colors.textPrimary },
    toggleOption: { borderColor: Colors.border, backgroundColor: Colors.surface },
    toggleOptionActive: { borderColor: Colors.primary, backgroundColor: Colors.primary },
    toggleText: { color: Colors.textSecondary },
    toggleTextActive: { color: Colors.surface },
    textInput: { backgroundColor: Colors.surface, color: Colors.textPrimary, borderColor: Colors.border },
    advancedToggle: { borderTopColor: Colors.border },
    advancedToggleText: { color: Colors.textMuted },
    counterRow: { backgroundColor: Colors.surface, borderColor: Colors.border },
    counterBtn: { backgroundColor: Colors.surfaceLight },
    counterValue: { color: Colors.textPrimary },
    scoringOption: { borderColor: Colors.border, backgroundColor: Colors.surface },
    scoringOptionSelected: { borderColor: Colors.primary, backgroundColor: Colors.primary + '08' },
    scoringName: { color: Colors.textPrimary },
    scoringDesc: { color: Colors.textSecondary },
    beforePhotoToggle: { backgroundColor: Colors.surface, borderColor: Colors.border },
    beforePhotoLabel: { color: Colors.textPrimary },
    beforePhotoSub: { color: Colors.textSecondary },
    toggleSwitch: { backgroundColor: Colors.border },
    toggleSwitchOn: { backgroundColor: Colors.primary },
    toggleKnob: { backgroundColor: Colors.surface },
    bottomBar: { backgroundColor: Colors.surface, borderTopColor: Colors.border },
    feePreview: { color: Colors.primary },
    feeNote: { color: Colors.textMuted },
    tierInfo: { backgroundColor: Colors.primaryGlow, borderColor: Colors.borderGold },
    tierInfoText: { color: Colors.primary },
    createButton: { backgroundColor: Colors.primary, ...Shadow.md },
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, dynamicStyles.container]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ─── Section 1: What kind of competition? ─── */}
        <Text style={[styles.sectionLabel, dynamicStyles.sectionLabel]}>What kind of competition?</Text>
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
                style={[styles.typeCard, dynamicStyles.typeCard, isSelected && dynamicStyles.typeCardSelected]}
                activeOpacity={0.7}
                onPress={() => selectCompType(comp)}
              >
                <Text style={styles.typeCardIcon}>{comp.icon}</Text>
                <Text style={[styles.typeCardName, dynamicStyles.typeCardName, isSelected && dynamicStyles.typeCardNameSelected]}>
                  {comp.name}
                </Text>
                <Text style={[styles.typeCardDesc, dynamicStyles.typeCardDesc]}>{comp.desc}</Text>
                {comp.watch && (
                  <Text style={[styles.typeCardWatch, dynamicStyles.typeCardWatch]}>{'\u{231A}'} Watch</Text>
                )}
                {!comp.watch && (
                  <Text style={[styles.typeCardPhone, dynamicStyles.typeCardPhone]}>{'\u{1F4F1}'} iPhone OK</Text>
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* ─── Section 2: Set the stakes ─── */}
        <Text style={[styles.sectionLabel, dynamicStyles.sectionLabel]}>Set the stakes</Text>

        {/* Entry Fee */}
        <Text style={[styles.fieldLabel, dynamicStyles.fieldLabel]}>Entry fee</Text>
        <View style={styles.pillRow}>
          {FEE_OPTIONS.map((opt) => {
            const isSelected = form.entryFeeCents === opt.cents && customFee === '';
            return (
              <TouchableOpacity
                key={opt.cents}
                style={[styles.pill, dynamicStyles.pill, isSelected && dynamicStyles.pillSelected]}
                onPress={() => {
                  updateForm('entryFeeCents', opt.cents);
                  setCustomFee('');
                }}
              >
                <Text style={[styles.pillText, dynamicStyles.pillText, isSelected && dynamicStyles.pillTextSelected]}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            );
          })}
          <TouchableOpacity
            style={[styles.pill, dynamicStyles.pill, customFee !== '' && dynamicStyles.pillSelected]}
            onPress={() => setCustomFee(customFee || '0')}
          >
            <Text style={[styles.pillText, dynamicStyles.pillText, customFee !== '' && dynamicStyles.pillTextSelected]}>
              Custom
            </Text>
          </TouchableOpacity>
        </View>
        {customFee !== '' && (
          <View style={[styles.customFeeRow, dynamicStyles.customFeeRow]}>
            <Text style={[styles.customFeePrefix, dynamicStyles.customFeePrefix]}>$</Text>
            <TextInput
              style={[styles.customFeeInput, dynamicStyles.customFeeInput]}
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
        <Text style={[styles.fieldLabel, dynamicStyles.fieldLabel]}>Duration</Text>
        <View style={styles.pillRow}>
          {DURATION_OPTIONS.map((dur) => {
            const isSelected = selectedDuration.days === dur.days;
            return (
              <TouchableOpacity
                key={dur.days}
                style={[styles.pill, dynamicStyles.pill, isSelected && dynamicStyles.pillSelected]}
                onPress={() => selectDuration(dur)}
              >
                <Text style={[styles.pillText, dynamicStyles.pillText, isSelected && dynamicStyles.pillTextSelected]}>
                  {dur.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Before Photo Toggle — only for 2+ week competitions */}
        {selectedDuration.days >= 14 && (
          <TouchableOpacity
            style={[styles.beforePhotoToggle, dynamicStyles.beforePhotoToggle]}
            activeOpacity={0.7}
            onPress={() => updateForm('allowBeforePhoto', !form.allowBeforePhoto)}
          >
            <Text style={styles.beforePhotoIcon}>{'\u{1F4F8}'}</Text>
            <View style={{ flex: 1 }}>
              <Text style={[styles.beforePhotoLabel, dynamicStyles.beforePhotoLabel]}>Allow before photos</Text>
              <Text style={[styles.beforePhotoSub, dynamicStyles.beforePhotoSub]}>Members can optionally share a starting-point photo</Text>
            </View>
            <View style={[styles.toggleSwitch, dynamicStyles.toggleSwitch, form.allowBeforePhoto && dynamicStyles.toggleSwitchOn]}>
              <View style={[styles.toggleKnob, dynamicStyles.toggleKnob, form.allowBeforePhoto && styles.toggleKnobOn]} />
            </View>
          </TouchableOpacity>
        )}

        {/* Public/Private Toggle */}
        <Text style={[styles.fieldLabel, dynamicStyles.fieldLabel]}>Visibility</Text>
        <View style={styles.toggleRow}>
          <TouchableOpacity
            style={[styles.toggleOption, dynamicStyles.toggleOption, !form.isPrivate && dynamicStyles.toggleOptionActive]}
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
            <Text style={[styles.toggleText, dynamicStyles.toggleText, !form.isPrivate && dynamicStyles.toggleTextActive]}>
              Public
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleOption, dynamicStyles.toggleOption, form.isPrivate && dynamicStyles.toggleOptionActive]}
            onPress={() => setForm((prev) => ({ ...prev, isPublic: false, isPrivate: true }))}
          >
            <Text style={[styles.toggleText, dynamicStyles.toggleText, form.isPrivate && dynamicStyles.toggleTextActive]}>
              Private
            </Text>
          </TouchableOpacity>
        </View>

        {/* Competition Name (optional) */}
        <Text style={[styles.fieldLabel, dynamicStyles.fieldLabel]}>Competition name <Text style={[styles.optionalTag, dynamicStyles.optionalTag]}>optional</Text></Text>
        <TextInput
          style={[styles.textInput, dynamicStyles.textInput]}
          placeholder={generateName()}
          placeholderTextColor={Colors.textMuted}
          value={form.name}
          onChangeText={(t) => updateForm('name', t)}
          maxLength={50}
        />

        {/* ─── Section 3: Advanced (collapsed) ─── */}
        <TouchableOpacity
          style={[styles.advancedToggle, dynamicStyles.advancedToggle]}
          onPress={() => setAdvancedOpen(!advancedOpen)}
          activeOpacity={0.7}
        >
          <Text style={[styles.advancedToggleText, dynamicStyles.advancedToggleText]}>Advanced</Text>
          <Ionicons
            name={advancedOpen ? 'chevron-up' : 'chevron-down'}
            size={18}
            color={Colors.textMuted}
          />
        </TouchableOpacity>

        {advancedOpen && (
          <View style={styles.advancedSection}>
            {/* Max Participants */}
            <Text style={[styles.fieldLabel, dynamicStyles.fieldLabel]}>Max participants</Text>
            <View style={[styles.counterRow, dynamicStyles.counterRow]}>
              <TouchableOpacity
                style={[styles.counterBtn, dynamicStyles.counterBtn]}
                onPress={() => updateForm('maxParticipants', Math.max(form.entryFeeCents > 0 ? MIN_PARTICIPANTS : 2, form.maxParticipants - 5))}
              >
                <Ionicons name="remove" size={20} color={Colors.textSecondary} />
              </TouchableOpacity>
              <Text style={[styles.counterValue, dynamicStyles.counterValue]}>{form.maxParticipants}</Text>
              <TouchableOpacity
                style={[styles.counterBtn, dynamicStyles.counterBtn]}
                onPress={() => updateForm('maxParticipants', Math.min(100, form.maxParticipants + 5))}
              >
                <Ionicons name="add" size={20} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Scoring Mode */}
            <Text style={[styles.fieldLabel, dynamicStyles.fieldLabel]}>Scoring mode</Text>
            {SCORING_MODES.map((mode) => {
              const isSelected = form.scoringMode === mode.id;
              const isLocked = mode.privateOnly && !form.isPrivate;
              return (
                <TouchableOpacity
                  key={mode.id}
                  style={[
                    styles.scoringOption,
                    dynamicStyles.scoringOption,
                    isSelected && dynamicStyles.scoringOptionSelected,
                    isLocked && { opacity: 0.4 },
                  ]}
                  onPress={() => {
                    if (!isLocked) updateForm('scoringMode', mode.id);
                    else Alert.alert('Private Only', 'Switch to Private to unlock this scoring mode.');
                  }}
                >
                  <Text style={[styles.scoringName, dynamicStyles.scoringName, isSelected && { color: Colors.primary }]}>
                    {mode.label}
                  </Text>
                  <Text style={[styles.scoringDesc, dynamicStyles.scoringDesc]}>{mode.description}</Text>
                </TouchableOpacity>
              );
            })}

            {/* Payment Method */}
            {form.entryFeeCents > 0 && (
              <>
                <Text style={[styles.fieldLabel, dynamicStyles.fieldLabel]}>Payment method</Text>
                <View style={styles.toggleRow}>
                  <TouchableOpacity
                    style={[styles.toggleOption, dynamicStyles.toggleOption, form.paymentType === 'stripe' && dynamicStyles.toggleOptionActive]}
                    onPress={() => updateForm('paymentType', 'stripe')}
                  >
                    <Ionicons name="card" size={16} color={form.paymentType === 'stripe' ? '#fff' : Colors.textSecondary} />
                    <Text style={[styles.toggleText, dynamicStyles.toggleText, form.paymentType === 'stripe' && dynamicStyles.toggleTextActive]}>Stripe</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.toggleOption, dynamicStyles.toggleOption, form.paymentType === 'usdc' && dynamicStyles.toggleOptionActive]}
                    onPress={() => updateForm('paymentType', 'usdc')}
                  >
                    <Ionicons name="wallet" size={16} color={form.paymentType === 'usdc' ? '#fff' : Colors.textSecondary} />
                    <Text style={[styles.toggleText, dynamicStyles.toggleText, form.paymentType === 'usdc' && dynamicStyles.toggleTextActive]}>USDC</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}

            {/* Tier Lock */}
            <Text style={[styles.fieldLabel, dynamicStyles.fieldLabel]}>Fitness tier restriction</Text>
            {creatorTier && (
              <View style={[styles.tierInfo, dynamicStyles.tierInfo]}>
                <Text style={[styles.tierInfoText, dynamicStyles.tierInfoText]}>
                  Your tier: {FITNESS_TIERS[creatorTier as keyof typeof FITNESS_TIERS]?.emoji} {FITNESS_TIERS[creatorTier as keyof typeof FITNESS_TIERS]?.label} ({FITNESS_TIERS[creatorTier as keyof typeof FITNESS_TIERS]?.description})
                </Text>
              </View>
            )}
            {TIER_LOCK_OPTIONS.map((opt) => {
              const isSelected = tierLock === opt.id;
              return (
                <TouchableOpacity
                  key={opt.id}
                  style={[styles.scoringOption, dynamicStyles.scoringOption, isSelected && dynamicStyles.scoringOptionSelected]}
                  onPress={() => setTierLock(opt.id)}
                >
                  <Text style={[styles.scoringName, dynamicStyles.scoringName, isSelected && { color: Colors.primary }]}>
                    {opt.id === 'none' ? '🌐' : opt.id === 'within_one' ? '🎯' : '🔒'} {opt.label}
                  </Text>
                  <Text style={[styles.scoringDesc, dynamicStyles.scoringDesc]}>{opt.description}</Text>
                </TouchableOpacity>
              );
            })}

            {/* Description */}
            <Text style={[styles.fieldLabel, dynamicStyles.fieldLabel]}>Description <Text style={[styles.optionalTag, dynamicStyles.optionalTag]}>optional</Text></Text>
            <TextInput
              style={[styles.textInput, dynamicStyles.textInput, styles.textArea]}
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
      <View style={[styles.bottomBar, dynamicStyles.bottomBar]}>
        {form.entryFeeCents > 0 && (
          <View>
            <Text style={[styles.feePreview, dynamicStyles.feePreview]}>
              {formatCents(form.entryFeeCents)} entry · {form.maxParticipants} players max · winner gets{' '}
              {formatCents(Math.floor(form.entryFeeCents * form.maxParticipants * 0.9))}
            </Text>
            <Text style={[styles.feeNote, dynamicStyles.feeNote]}>
              Needs {MIN_PARTICIPANTS}+ players to run · Full refund if it doesn't fill
            </Text>
            <Text style={[styles.feeNote, dynamicStyles.feeNote]}>
              Tiebreaker: best streak → earliest join date
            </Text>
          </View>
        )}
        <TouchableOpacity
          style={[styles.createButton, dynamicStyles.createButton, submitting && { opacity: 0.6 }]}
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
  },
  scrollContent: {
    padding: Spacing.lg,
    paddingBottom: 180,
  },
  sectionLabel: {
    fontSize: FontSize.xl,
    fontWeight: '800',
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
    gap: 4,
  },
  typeCardIcon: {
    fontSize: 28,
    marginBottom: 4,
  },
  typeCardName: {
    fontSize: FontSize.md,
    fontWeight: '700',
  },
  typeCardDesc: {
    fontSize: FontSize.xs,
    lineHeight: 15,
  },
  typeCardWatch: {
    fontSize: FontSize.xs,
    fontWeight: '600',
    marginTop: 4,
  },
  typeCardPhone: {
    fontSize: FontSize.xs,
    fontWeight: '600',
    marginTop: 4,
  },
  fieldLabel: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: Spacing.sm,
    marginTop: Spacing.xl,
  },
  optionalTag: {
    fontWeight: '400',
    textTransform: 'none',
    letterSpacing: 0,
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
  },
  pillText: {
    fontSize: FontSize.md,
    fontWeight: '600',
  },
  customFeeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.sm,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    paddingHorizontal: Spacing.lg,
  },
  customFeePrefix: {
    fontSize: FontSize.xl,
    fontWeight: '700',
  },
  customFeeInput: {
    flex: 1,
    fontSize: FontSize.xl,
    fontWeight: '700',
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
  },
  toggleText: {
    fontSize: FontSize.md,
    fontWeight: '600',
  },
  textInput: {
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    fontSize: FontSize.md,
    borderWidth: 1,
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
  },
  advancedToggleText: {
    fontSize: FontSize.md,
    fontWeight: '600',
  },
  advancedSection: {
    paddingBottom: Spacing.lg,
  },
  counterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xxl,
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.lg,
    borderWidth: 1,
  },
  counterBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  counterValue: {
    fontSize: FontSize.xxl,
    fontWeight: '800',
    minWidth: 50,
    textAlign: 'center',
  },
  scoringOption: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    borderWidth: 1.5,
    marginBottom: Spacing.sm,
  },
  scoringName: {
    fontSize: FontSize.md,
    fontWeight: '700',
    marginBottom: 2,
  },
  scoringDesc: {
    fontSize: FontSize.sm,
    lineHeight: 18,
  },
  beforePhotoToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.lg,
    marginTop: Spacing.xl,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
  },
  beforePhotoIcon: {
    fontSize: 24,
  },
  beforePhotoLabel: {
    fontSize: FontSize.md,
    fontWeight: '600',
  },
  beforePhotoSub: {
    fontSize: FontSize.xs,
    marginTop: 2,
  },
  toggleSwitch: {
    width: 44,
    height: 26,
    borderRadius: 13,
    padding: 2,
    justifyContent: 'center',
  },
  toggleSwitchOn: {},
  toggleKnob: {
    width: 22,
    height: 22,
    borderRadius: 11,
  },
  toggleKnobOn: {
    alignSelf: 'flex-end',
  },
  bottomBar: {
    flexDirection: 'column',
    padding: Spacing.lg,
    paddingBottom: 34,
    borderTopWidth: 1,
    gap: Spacing.md,
  },
  feePreview: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    marginBottom: 2,
  },
  feeNote: {
    fontSize: FontSize.xs,
    marginTop: 1,
  },
  tierInfo: {
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    borderWidth: 1,
  },
  tierInfoText: {
    fontSize: FontSize.sm,
    fontWeight: '600',
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.lg,
    borderRadius: BorderRadius.lg,
  },
  createButtonText: {
    color: '#fff',
    fontSize: FontSize.md,
    fontWeight: '700',
  },
});
