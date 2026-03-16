/**
 * Podium — Weigh-In Screen
 * Used for Weight Loss % competitions.
 *
 * Flow:
 * 1. Enter current weight
 * 2. Take/upload photo of scale with feet visible
 * 3. Submit — anomaly detection runs server-side
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  ScrollView,
  Image,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Colors, Spacing, BorderRadius, FontSize, Shadow } from '@/constants/theme';
import { supabase } from '@/lib/supabase';
import { logWeighIn, validateWeighIn, calculateWeightLossPct } from '@/lib/healthkit';
import { useAuth } from '@/hooks/useAuth';

export default function WeighInScreen() {
  const { participantId, competitionId, isStarting, previousWeight, daysSinceLast } = useLocalSearchParams<{
    participantId: string;
    competitionId: string;
    isStarting: string;
    previousWeight: string;
    daysSinceLast: string;
  }>();
  const router = useRouter();
  const { profile } = useAuth();

  const [weightInput, setWeightInput] = useState('');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const isStartingWeight = isStarting === 'true';
  const prevWeight = previousWeight ? parseFloat(previousWeight) : null;
  const daysSince = daysSinceLast ? parseInt(daysSinceLast) : 7;

  const handlePickPhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Camera Required', 'Please allow camera access to take a photo of your scale.');
      return;
    }

    Alert.alert(
      'Scale Photo',
      'Take a photo of your scale showing your weight with your feet visible on the scale.',
      [
        {
          text: 'Take Photo',
          onPress: async () => {
            const result = await ImagePicker.launchCameraAsync({
              quality: 0.8,
              allowsEditing: false,
            });
            if (!result.canceled && result.assets[0]) {
              setPhotoUri(result.assets[0].uri);
            }
          },
        },
        {
          text: 'Choose from Library',
          onPress: async () => {
            const result = await ImagePicker.launchImageLibraryAsync({
              quality: 0.8,
              allowsEditing: false,
            });
            if (!result.canceled && result.assets[0]) {
              setPhotoUri(result.assets[0].uri);
            }
          },
        },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const handleSubmit = async () => {
    const weight = parseFloat(weightInput);

    if (!weightInput || isNaN(weight) || weight < 50 || weight > 700) {
      Alert.alert('Invalid Weight', 'Please enter a valid weight between 50 and 700 lbs.');
      return;
    }

    if (!photoUri) {
      Alert.alert('Photo Required', 'Please take a photo of your scale to verify your weight.');
      return;
    }

    if (!profile) return;

    // Pre-check anomaly before uploading
    if (!isStartingWeight && prevWeight && daysSince) {
      const check = validateWeighIn(prevWeight, weight, daysSince);
      if (check.flagged) {
        const proceed = await new Promise<boolean>((resolve) => {
          Alert.alert(
            '⚠️ Unusual Weight Change',
            `This weigh-in shows ${((prevWeight - weight) / prevWeight * 100).toFixed(1)}% loss in ${daysSince} day(s), which exceeds the realistic maximum. Your entry will be flagged for review.\n\nThis could affect your standing if confirmed as inaccurate. Continue?`,
            [
              { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
              { text: 'Submit Anyway', onPress: () => resolve(true) },
            ]
          );
        });
        if (!proceed) return;
      }
    }

    setUploading(true);
    try {
      // Upload photo proof to Supabase Storage
      const ext = photoUri.split('.').pop() ?? 'jpg';
      const path = `weigh-ins/${competitionId}/${profile.id}_${Date.now()}.${ext}`;
      const response = await fetch(photoUri);
      const blob = await response.blob();

      const { error: uploadError } = await supabase.storage
        .from('weigh-in-proofs')
        .upload(path, blob, { upsert: false });

      if (uploadError) throw new Error('Photo upload failed. Please try again.');

      const { data: urlData } = supabase.storage
        .from('weigh-in-proofs')
        .getPublicUrl(path);

      // Log the weigh-in
      const result = await logWeighIn(
        participantId,
        weight,
        isStartingWeight,
        urlData.publicUrl,
        prevWeight ?? undefined,
        daysSince
      );

      if (!result.success) {
        Alert.alert('Error', result.error ?? 'Failed to log weigh-in.');
        return;
      }

      // Show success
      if (result.flagged) {
        Alert.alert(
          '⚠️ Weigh-In Flagged',
          'Your weigh-in was logged but flagged for review due to an unusual weight change. You\'ll be notified of the outcome.',
          [{ text: 'OK', onPress: () => router.replace(`/competition/${competitionId}`) }]
        );
      } else if (isStartingWeight) {
        Alert.alert(
          '✅ Starting Weight Logged!',
          `${weight} lbs recorded as your starting weight. Good luck!`,
          [{ text: 'Let\'s Go!', onPress: () => router.replace(`/competition/${competitionId}`) }]
        );
      } else {
        const lossPct = prevWeight ? calculateWeightLossPct(prevWeight, weight) : 0;
        const msg = lossPct > 0
          ? `${weight} lbs logged. You're down ${(prevWeight! - weight).toFixed(1)} lbs (${lossPct}% loss). Keep going! 💪`
          : `${weight} lbs logged.`;
        Alert.alert('✅ Weigh-In Logged!', msg, [
          { text: 'View Leaderboard', onPress: () => router.replace(`/competition/${competitionId}`) },
        ]);
      }
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Something went wrong.');
    } finally {
      setUploading(false);
    }
  };

  const weightNum = parseFloat(weightInput);
  const previewLoss = !isStartingWeight && prevWeight && !isNaN(weightNum) && weightNum < prevWeight
    ? calculateWeightLossPct(prevWeight, weightNum)
    : null;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={styles.header}>
          <View style={styles.iconWrap}>
            <Text style={styles.icon}>⚖️</Text>
          </View>
          <Text style={styles.title}>
            {isStartingWeight ? 'Log Starting Weight' : 'Weekly Weigh-In'}
          </Text>
          <Text style={styles.subtitle}>
            {isStartingWeight
              ? 'This sets your baseline. All future progress is calculated from this weight.'
              : 'Log your weight weekly. Photo proof is required to keep it fair for everyone.'}
          </Text>
        </View>

        {/* Weight input */}
        <View style={styles.inputSection}>
          <Text style={styles.inputLabel}>Current Weight (lbs)</Text>
          <View style={styles.weightInputRow}>
            <TextInput
              style={styles.weightInput}
              value={weightInput}
              onChangeText={setWeightInput}
              keyboardType="decimal-pad"
              placeholder="e.g. 185.5"
              placeholderTextColor={Colors.textMuted}
              maxLength={6}
            />
            <Text style={styles.weightUnit}>lbs</Text>
          </View>

          {/* Live loss preview */}
          {previewLoss !== null && (
            <View style={styles.lossPreview}>
              <Ionicons name="trending-down" size={16} color={Colors.success} />
              <Text style={styles.lossPreviewText}>
                {previewLoss}% body weight lost so far
              </Text>
            </View>
          )}
          {!isStartingWeight && prevWeight && !isNaN(weightNum) && weightNum > prevWeight && (
            <View style={[styles.lossPreview, { backgroundColor: '#F59E0B18' }]}>
              <Ionicons name="trending-up" size={16} color={Colors.warning} />
              <Text style={[styles.lossPreviewText, { color: Colors.warning }]}>
                Up {(weightNum - prevWeight).toFixed(1)} lbs from last week
              </Text>
            </View>
          )}
        </View>

        {/* Photo proof */}
        <View style={styles.photoSection}>
          <Text style={styles.inputLabel}>Scale Photo (Required)</Text>
          <Text style={styles.photoHint}>
            📸 Stand on your scale and take a photo showing the number and your feet. This verifies your weigh-in is real.
          </Text>

          {photoUri ? (
            <View style={styles.photoPreview}>
              <Image source={{ uri: photoUri }} style={styles.photoImage} resizeMode="cover" />
              <TouchableOpacity style={styles.retakeButton} onPress={handlePickPhoto}>
                <Ionicons name="camera" size={16} color={Colors.primary} />
                <Text style={styles.retakeText}>Retake</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity style={styles.photoPickerBtn} onPress={handlePickPhoto} activeOpacity={0.7}>
              <Ionicons name="camera-outline" size={32} color={Colors.primary} />
              <Text style={styles.photoPickerText}>Take Scale Photo</Text>
              <Text style={styles.photoPickerSub}>Camera or library</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Anti-cheat notice */}
        <View style={styles.fairnessNote}>
          <Ionicons name="shield-checkmark" size={16} color={Colors.success} />
          <Text style={styles.fairnessText}>
            Weigh-ins over 3% per week are automatically flagged. This keeps the competition fair for everyone.
          </Text>
        </View>

        {/* Submit */}
        <TouchableOpacity
          style={[
            styles.submitButton,
            (!weightInput || !photoUri || uploading) && { opacity: 0.5 },
          ]}
          onPress={handleSubmit}
          disabled={!weightInput || !photoUri || uploading}
          activeOpacity={0.85}
        >
          {uploading ? (
            <ActivityIndicator color="#000" />
          ) : (
            <>
              <Ionicons name="checkmark-circle" size={20} color="#000" />
              <Text style={styles.submitText}>
                {isStartingWeight ? 'Set Starting Weight' : 'Submit Weigh-In'}
              </Text>
            </>
          )}
        </TouchableOpacity>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scrollContent: { padding: Spacing.xl, paddingBottom: 60 },
  header: { alignItems: 'center', marginBottom: Spacing.xxxl },
  iconWrap: { width: 72, height: 72, borderRadius: 36, backgroundColor: Colors.primaryGlow, justifyContent: 'center', alignItems: 'center', marginBottom: Spacing.lg },
  icon: { fontSize: 36 },
  title: { fontSize: FontSize.xxl, fontWeight: '800', color: Colors.textPrimary, textAlign: 'center', marginBottom: Spacing.sm },
  subtitle: { fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'center', lineHeight: 20, maxWidth: 300 },
  inputSection: { marginBottom: Spacing.xxl },
  inputLabel: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: Spacing.md },
  weightInputRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface, borderRadius: BorderRadius.lg, borderWidth: 2, borderColor: Colors.border, paddingHorizontal: Spacing.xl, overflow: 'hidden' },
  weightInput: { flex: 1, fontSize: 36, fontWeight: '800', color: Colors.textPrimary, paddingVertical: Spacing.lg },
  weightUnit: { fontSize: FontSize.lg, fontWeight: '600', color: Colors.textMuted },
  lossPreview: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, marginTop: Spacing.md, backgroundColor: '#22C55E18', borderRadius: BorderRadius.md, padding: Spacing.md },
  lossPreviewText: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.success },
  photoSection: { marginBottom: Spacing.xl },
  photoHint: { fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 20, marginBottom: Spacing.md },
  photoPickerBtn: { alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, paddingVertical: Spacing.xxxl, borderRadius: BorderRadius.lg, borderWidth: 2, borderColor: Colors.primaryGlow, borderStyle: 'dashed', backgroundColor: Colors.primaryGlow },
  photoPickerText: { fontSize: FontSize.md, fontWeight: '700', color: Colors.primary },
  photoPickerSub: { fontSize: FontSize.xs, color: Colors.textMuted },
  photoPreview: { borderRadius: BorderRadius.lg, overflow: 'hidden', position: 'relative' },
  photoImage: { width: '100%', height: 240, borderRadius: BorderRadius.lg },
  retakeButton: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, position: 'absolute', top: Spacing.md, right: Spacing.md, backgroundColor: 'rgba(0,0,0,0.7)', paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: BorderRadius.full },
  retakeText: { fontSize: FontSize.sm, color: Colors.primary, fontWeight: '600' },
  fairnessNote: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm, backgroundColor: '#22C55E10', borderRadius: BorderRadius.md, padding: Spacing.lg, marginBottom: Spacing.xl, borderWidth: 1, borderColor: '#22C55E20' },
  fairnessText: { flex: 1, fontSize: FontSize.xs, color: Colors.textSecondary, lineHeight: 18 },
  submitButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, backgroundColor: Colors.primary, paddingVertical: Spacing.lg, borderRadius: BorderRadius.lg, ...Shadow.gold },
  submitText: { fontSize: FontSize.md, fontWeight: '800', color: '#000' },
});
