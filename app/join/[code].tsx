import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
  ScrollView,
  Image,
  TextInput,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import * as ImagePicker from "expo-image-picker";
import {
  Spacing,
  BorderRadius,
  FontSize,
  CompetitionTypes,
} from "@/constants/theme";
import { useTheme } from "@/contexts/ThemeContext";
import { formatCents } from "@/lib/stripe";
import { getEscrowAddress } from "@/lib/usdc";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import { checkAppleWatchPaired, checkBaselineReadiness } from "@/lib/healthkit";
import { checkComplianceForPaidCompetition } from "@/lib/compliance";
import { competitionPrizeInCredits } from "@/lib/prizes";
import { validatePromoCode, recordPromoRedemption, formatDiscount } from "@/lib/promos";
import type { Competition } from "@/lib/types";
import type { PaymentMethod } from "@/lib/payments";

export default function JoinScreen() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const router = useRouter();
  const { profile, isAuthenticated } = useAuth();
  const { Colors, Shadow } = useTheme();
  const [competition, setCompetition] = useState<Competition | null>(null);
  const [participantCount, setParticipantCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [alreadyJoined, setAlreadyJoined] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("stripe");
  const [copied, setCopied] = useState(false);
  const [showBeforePhoto, setShowBeforePhoto] = useState(false);
  const [beforePhotoUri, setBeforePhotoUri] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  // Promo code state
  const [promoInput, setPromoInput] = useState("");
  const [promoApplied, setPromoApplied] = useState(false);
  const [promoDiscount, setPromoDiscount] = useState(0);
  const [promoMessage, setPromoMessage] = useState("");
  const [promoError, setPromoError] = useState("");
  const [promoLoading, setPromoLoading] = useState(false);

  // Dynamic styles — recomputed whenever Colors/Shadow change (theme switch)
  const dynamicStyles = {
    scrollContainer: { backgroundColor: Colors.background },
    centered: { backgroundColor: Colors.background },
    loadingText: { color: Colors.textSecondary },
    errorTitle: { color: Colors.textPrimary },
    errorSubtitle: { color: Colors.textSecondary },
    backHomeBtn: { backgroundColor: Colors.primary },
    card: { backgroundColor: Colors.surface, ...Shadow.lg },
    inviteBadge: { backgroundColor: Colors.primaryGlow },
    inviteBadgeText: { color: Colors.primary },
    competitionName: { color: Colors.textPrimary },
    description: { color: Colors.textSecondary },
    detailsGrid: { borderTopColor: Colors.borderLight },
    detailText: { color: Colors.textPrimary },
    promoLabel: { color: Colors.textSecondary },
    promoInput: {
      backgroundColor: Colors.surfaceLight,
      color: Colors.textPrimary,
      borderColor: Colors.border,
    },
    promoButton: { backgroundColor: Colors.primary },
    promoButtonRemove: { backgroundColor: Colors.surfaceLight, borderColor: Colors.border },
    promoButtonRemoveText: { color: Colors.textSecondary },
    promoSuccessText: { color: Colors.success },
    promoErrorText: { color: Colors.error },
    feesummary: { backgroundColor: Colors.background, borderColor: Colors.border },
    feeLabelText: { color: Colors.textSecondary },
    feeValueText: { color: Colors.textPrimary },
    feeValueStrike: { color: Colors.textMuted },
    feeTotalLine: { borderTopColor: Colors.border },
    feeTotalLabel: { color: Colors.textPrimary },
    feeTotalValue: { color: Colors.primary },
    paymentSectionTitle: { color: Colors.textPrimary },
    paymentOption: { borderColor: Colors.border },
    paymentOptionSelected: { borderColor: Colors.primary, backgroundColor: Colors.primaryGlow },
    radioOuter: { borderColor: Colors.textMuted },
    radioInner: { backgroundColor: Colors.primary },
    paymentOptionTitle: { color: Colors.textPrimary },
    paymentOptionNote: { color: Colors.textMuted },
    addressCopyBtn: { backgroundColor: Colors.primaryGlow },
    usdcAddress: { color: Colors.primary },
    joinButton: { backgroundColor: Colors.primary, ...Shadow.gold },
    beforePhotoCard: { backgroundColor: Colors.background, borderColor: Colors.border },
    beforePhotoTitle: { color: Colors.textPrimary },
    beforePhotoSubtitle: { color: Colors.textSecondary },
    beforePhotoPickerBtn: { borderColor: Colors.primaryGlow, backgroundColor: Colors.primaryGlow },
    beforePhotoPickerText: { color: Colors.primary },
    beforePhotoImage: { backgroundColor: Colors.surface },
    beforePhotoRetake: { borderColor: Colors.border },
    beforePhotoRetakeText: { color: Colors.textSecondary },
    beforePhotoUploadBtn: { backgroundColor: Colors.primary },
    beforePhotoSkipText: { color: Colors.textMuted },
  };

  useEffect(() => {
    fetchCompetition();
  }, [code]);

  async function fetchCompetition() {
    setLoading(true);
    const { data: comp } = await supabase
      .from("competitions")
      .select("*")
      .eq("invite_code", code)
      .single();

    if (comp) {
      setCompetition(comp as Competition);
      const { count } = await supabase
        .from("participants")
        .select("*", { count: "exact", head: true })
        .eq("competition_id", comp.id);
      setParticipantCount(count ?? 0);

      if (profile) {
        const { data: existing } = await supabase
          .from("participants")
          .select("id")
          .eq("competition_id", comp.id)
          .eq("user_id", profile.id)
          .single();
        if (existing) setAlreadyJoined(true);
      }
    }
    setLoading(false);
  }

  const competitionDurationDays = competition
    ? Math.ceil((new Date(competition.end_date).getTime() - new Date(competition.start_date).getTime()) / (1000 * 60 * 60 * 24))
    : 0;

  const shouldOfferBeforePhoto = competition?.allow_before_photo === true && competitionDurationDays >= 14;

  const effectiveEntryCents = competition
    ? Math.max(0, competition.entry_fee_cents - promoDiscount)
    : 0;

  const handleApplyPromo = async () => {
    if (!promoInput.trim() || !competition || !profile) return;
    setPromoLoading(true);
    setPromoError("");
    setPromoMessage("");

    const result = await validatePromoCode(promoInput, profile.id, competition.entry_fee_cents);
    if (result.valid) {
      setPromoApplied(true);
      setPromoDiscount(result.discountCents);
      setPromoMessage(result.message ?? "Promo applied!");
    } else {
      setPromoError(result.error ?? "Invalid promo code.");
      setPromoApplied(false);
      setPromoDiscount(0);
    }
    setPromoLoading(false);
  };

  const handlePickBeforePhoto = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
      allowsEditing: true,
      aspect: [3, 4],
    });
    if (result.canceled || !result.assets?.[0]) return;
    setBeforePhotoUri(result.assets[0].uri);
  };

  const handleUploadBeforePhoto = async () => {
    if (!beforePhotoUri || !competition || !profile) return;
    setUploadingPhoto(true);
    try {
      const ext = beforePhotoUri.split(".").pop() ?? "jpg";
      const path = `${competition.id}/${profile.id}.${ext}`;
      const response = await fetch(beforePhotoUri);
      const blob = await response.blob();
      const { error: uploadError } = await supabase.storage.from("before-photos").upload(path, blob, { upsert: true });
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage.from("before-photos").getPublicUrl(path);
      await supabase.from("before_photos").upsert({ competition_id: competition.id, user_id: profile.id, photo_url: urlData.publicUrl }, { onConflict: "competition_id,user_id" });
      Alert.alert("Photo saved!", "Your before photo has been uploaded.", [{ text: "View Competition", onPress: () => router.replace(`/competition/${competition.id}`) }]);
    } catch {
      Alert.alert("Upload failed", "Could not upload your photo. Try again.");
    } finally {
      setUploadingPhoto(false);
    }
  };

  const copyEscrowAddress = async () => {
    await Clipboard.setStringAsync(getEscrowAddress());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleJoin = async () => {
    if (!isAuthenticated) { router.push("/(auth)/welcome?modal=1"); return; }
    if (!profile || !competition) return;

    setJoining(true);
    try {
      // Compliance check for paid competitions
      if (effectiveEntryCents > 0) {
        const compliance = await checkComplianceForPaidCompetition(profile.id, competition);
        if (!compliance.allowed) {
          if (compliance.requiresAgeVerification) {
            Alert.alert("Age Verification Required", "You must verify your age before joining paid competitions.", [
              { text: "Cancel", style: "cancel" },
              { text: "Verify Age", onPress: () => router.push("/(onboarding)/age-verify") },
            ]);
          } else {
            Alert.alert("Not Available", compliance.reason ?? "Paid competitions are not available in your region.");
          }
          return;
        }
      }

      // Baseline readiness check for % Improvement competitions
      if (competition.scoring_mode === 'relative_improvement') {
        const baseline = await checkBaselineReadiness();
        if (!baseline.canJoinImprovementCompetition && baseline.message) {
          const isPaid = effectiveEntryCents > 0;
          Alert.alert(
            '📊 Not Enough Activity Data',
            baseline.message,
            [
              { text: 'Got it', style: 'cancel' },
              ...(!isPaid ? [{ text: 'Join Anyway', onPress: async () => {
                await supabase.from('participants').insert({ competition_id: competition.id, user_id: profile.id, paid: true });
                router.replace(`/competition/${competition.id}`);
              }}] : []),
            ]
          );
          return;
        }
      }

      // Apple Watch check
      if (competition.requires_watch) {
        const hasPaired = await checkAppleWatchPaired();
        if (!hasPaired && !__DEV__) {
          Alert.alert("Apple Watch Required", "Connect an Apple Watch to join.", [{ text: "OK" }]);
          return;
        }
      }

      // Insert participant
      const { error } = await supabase.from("participants").insert({
        competition_id: competition.id,
        user_id: profile.id,
        paid: effectiveEntryCents === 0,
      });
      if (error) throw error;

      // Record promo redemption if applied
      if (promoApplied && promoInput && promoDiscount > 0) {
        await recordPromoRedemption(promoInput, profile.id, competition.id, promoDiscount);
      }

      const prizeCredits = competitionPrizeInCredits(Math.floor(competition.prize_pool_cents * 0.9));
      const successMsg = effectiveEntryCents === 0
        ? `You're in "${competition.name}" for FREE! Winner earns ${prizeCredits}.`
        : `You're in "${competition.name}"! Winner earns ${prizeCredits}.`;

      Alert.alert("You're In! 🏆", successMsg, [
        { text: shouldOfferBeforePhoto ? "Add Before Photo" : "Let's Go!", onPress: () => shouldOfferBeforePhoto ? setShowBeforePhoto(true) : router.replace(`/competition/${competition.id}`) },
      ]);
    } catch {
      Alert.alert("Error", "Failed to join. You may already be a participant.");
    } finally {
      setJoining(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.centered, dynamicStyles.centered]}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={[styles.loadingText, dynamicStyles.loadingText]}>Finding competition...</Text>
      </View>
    );
  }

  if (!competition) {
    return (
      <View style={[styles.centered, dynamicStyles.centered]}>
        <Ionicons name="alert-circle-outline" size={64} color={Colors.textMuted} />
        <Text style={[styles.errorTitle, dynamicStyles.errorTitle]}>Competition Not Found</Text>
        <Text style={[styles.errorSubtitle, dynamicStyles.errorSubtitle]}>The invite code "{code}" doesn't match any competition.</Text>
        <TouchableOpacity style={[styles.backHomeBtn, dynamicStyles.backHomeBtn]} onPress={() => router.replace("/(tabs)")}>
          <Text style={styles.backHomeBtnText}>Go Home</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const typeInfo = CompetitionTypes[competition.type] ?? CompetitionTypes.custom;
  const isFull = participantCount >= competition.max_participants;
  const hasFee = competition.entry_fee_cents > 0;

  return (
    <ScrollView style={[styles.scrollContainer, dynamicStyles.scrollContainer]} contentContainerStyle={styles.scrollContent}>
      <View style={[styles.card, dynamicStyles.card]}>
        {/* Invite badge */}
        <View style={[styles.inviteBadge, dynamicStyles.inviteBadge]}>
          <Ionicons name="mail-open" size={20} color={Colors.primary} />
          <Text style={[styles.inviteBadgeText, dynamicStyles.inviteBadgeText]}>You've been invited!</Text>
        </View>

        <View style={[styles.typeBadge, { backgroundColor: typeInfo.color + "18" }]}>
          <Text>{typeInfo.emoji}</Text>
          <Text style={[styles.typeLabel, { color: typeInfo.color }]}>{typeInfo.label}</Text>
        </View>

        <View style={[styles.watchBadge, { backgroundColor: competition.requires_watch ? Colors.warning + "18" : Colors.success + "18" }]}>
          <Text style={styles.watchBadgeIcon}>{competition.requires_watch ? "⌚" : "📱"}</Text>
          <Text style={[styles.watchBadgeText, { color: competition.requires_watch ? Colors.warning : Colors.success }]}>
            {competition.requires_watch ? "Requires Apple Watch" : "iPhone Compatible"}
          </Text>
        </View>

        <Text style={[styles.competitionName, dynamicStyles.competitionName]}>{competition.name}</Text>
        {competition.description && <Text style={[styles.description, dynamicStyles.description]}>{competition.description}</Text>}

        {/* Details */}
        <View style={[styles.detailsGrid, dynamicStyles.detailsGrid]}>
          <View style={styles.detailItem}>
            <Ionicons name="calendar" size={18} color={Colors.textMuted} />
            <Text style={[styles.detailText, dynamicStyles.detailText]}>{new Date(competition.start_date).toLocaleDateString()} — {new Date(competition.end_date).toLocaleDateString()}</Text>
          </View>
          <View style={styles.detailItem}>
            <Ionicons name="people" size={18} color={Colors.textMuted} />
            <Text style={[styles.detailText, dynamicStyles.detailText]}>{participantCount}/{competition.max_participants} players</Text>
          </View>
          <View style={styles.detailItem}>
            <Ionicons name="cash" size={18} color={Colors.textMuted} />
            <Text style={[styles.detailText, dynamicStyles.detailText]}>Entry: {formatCents(competition.entry_fee_cents)}</Text>
          </View>
          <View style={styles.detailItem}>
            <Ionicons name="trophy" size={18} color={Colors.primary} />
            <Text style={[styles.detailText, { color: Colors.primary, fontWeight: "700" }]}>
              Prize: {competitionPrizeInCredits(Math.floor(competition.prize_pool_cents * 0.9))}
            </Text>
          </View>
        </View>

        {/* ── Promo Code ── */}
        {hasFee && !alreadyJoined && !isFull && (
          <View style={styles.promoSection}>
            <Text style={[styles.promoLabel, dynamicStyles.promoLabel]}>Have a promo code?</Text>
            <View style={styles.promoRow}>
              <TextInput
                style={[styles.promoInput, dynamicStyles.promoInput]}
                placeholder="e.g. PODIUM10"
                placeholderTextColor={Colors.textMuted}
                value={promoInput}
                onChangeText={(t) => { setPromoInput(t.toUpperCase()); setPromoError(""); setPromoApplied(false); setPromoDiscount(0); setPromoMessage(""); }}
                autoCapitalize="characters"
                editable={!promoApplied}
              />
              {promoApplied ? (
                <TouchableOpacity style={[styles.promoButton, styles.promoButtonRemove, dynamicStyles.promoButtonRemove]} onPress={() => { setPromoApplied(false); setPromoDiscount(0); setPromoMessage(""); setPromoInput(""); }}>
                  <Text style={[styles.promoButtonRemoveText, dynamicStyles.promoButtonRemoveText]}>Remove</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity style={[styles.promoButton, dynamicStyles.promoButton, !promoInput.trim() && { opacity: 0.5 }]} onPress={handleApplyPromo} disabled={!promoInput.trim() || promoLoading}>
                  <Text style={styles.promoButtonText}>{promoLoading ? "..." : "Apply"}</Text>
                </TouchableOpacity>
              )}
            </View>
            {promoMessage ? (
              <View style={styles.promoSuccess}>
                <Ionicons name="checkmark-circle" size={16} color={Colors.success} />
                <Text style={[styles.promoSuccessText, dynamicStyles.promoSuccessText]}>{promoMessage}</Text>
              </View>
            ) : null}
            {promoError ? (
              <Text style={[styles.promoErrorText, dynamicStyles.promoErrorText]}>{promoError}</Text>
            ) : null}
          </View>
        )}

        {/* ── Entry fee summary ── */}
        {hasFee && !alreadyJoined && !isFull && (
          <View style={[styles.feesummary, dynamicStyles.feesummary]}>
            {promoApplied && promoDiscount > 0 && (
              <View style={styles.feeLine}>
                <Text style={[styles.feeLabelText, dynamicStyles.feeLabelText]}>Original fee</Text>
                <Text style={[styles.feeValueStrike, dynamicStyles.feeValueStrike]}>{formatCents(competition.entry_fee_cents)}</Text>
              </View>
            )}
            {promoApplied && promoDiscount > 0 && (
              <View style={styles.feeLine}>
                <Text style={[styles.feeLabelText, dynamicStyles.feeLabelText]}>Promo ({promoInput})</Text>
                <Text style={[styles.feeValueText, dynamicStyles.feeValueText, { color: Colors.success }]}>-{formatCents(promoDiscount)}</Text>
              </View>
            )}
            <View style={[styles.feeLine, styles.feeTotalLine, dynamicStyles.feeTotalLine]}>
              <Text style={[styles.feeTotalLabel, dynamicStyles.feeTotalLabel]}>You pay</Text>
              <Text style={[styles.feeTotalValue, dynamicStyles.feeTotalValue, effectiveEntryCents === 0 && { color: Colors.success }]}>
                {effectiveEntryCents === 0 ? "FREE 🎉" : formatCents(effectiveEntryCents)}
              </Text>
            </View>
          </View>
        )}

        {/* ── Payment method ── */}
        {hasFee && effectiveEntryCents > 0 && !alreadyJoined && !isFull && (
          <View style={styles.paymentSection}>
            <Text style={[styles.paymentSectionTitle, dynamicStyles.paymentSectionTitle]}>Payment Method</Text>
            <TouchableOpacity style={[styles.paymentOption, dynamicStyles.paymentOption, paymentMethod === "stripe" && dynamicStyles.paymentOptionSelected]} onPress={() => setPaymentMethod("stripe")} activeOpacity={0.7}>
              <View style={styles.paymentOptionHeader}>
                <View style={[styles.radioOuter, dynamicStyles.radioOuter]}>{paymentMethod === "stripe" && <View style={[styles.radioInner, dynamicStyles.radioInner]} />}</View>
                <Text style={styles.paymentOptionIcon}>💳</Text>
                <Text style={[styles.paymentOptionTitle, dynamicStyles.paymentOptionTitle]}>Card / Apple Pay</Text>
              </View>
              <Text style={[styles.paymentOptionNote, dynamicStyles.paymentOptionNote]}>Secure · Instant · Refunded if cancelled</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.paymentOption, dynamicStyles.paymentOption, paymentMethod === "usdc" && dynamicStyles.paymentOptionSelected]} onPress={() => setPaymentMethod("usdc")} activeOpacity={0.7}>
              <View style={styles.paymentOptionHeader}>
                <View style={[styles.radioOuter, dynamicStyles.radioOuter]}>{paymentMethod === "usdc" && <View style={[styles.radioInner, dynamicStyles.radioInner]} />}</View>
                <Text style={styles.paymentOptionIcon}>🔵</Text>
                <Text style={[styles.paymentOptionTitle, dynamicStyles.paymentOptionTitle]}>USDC (Base)</Text>
              </View>
              {paymentMethod === "usdc" && (
                <View style={styles.usdcDetails}>
                  <TouchableOpacity style={[styles.addressCopyBtn, dynamicStyles.addressCopyBtn]} onPress={copyEscrowAddress}>
                    <Text style={[styles.usdcAddress, dynamicStyles.usdcAddress]}>{`${getEscrowAddress().slice(0, 8)}...${getEscrowAddress().slice(-4)}`}</Text>
                    <Ionicons name={copied ? "checkmark" : "copy-outline"} size={14} color={Colors.primary} />
                  </TouchableOpacity>
                </View>
              )}
              <Text style={[styles.paymentOptionNote, dynamicStyles.paymentOptionNote]}>⚡ Zero fees · Instant payout</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── Join button ── */}
        {alreadyJoined ? (
          <TouchableOpacity style={[styles.joinButton, { backgroundColor: Colors.success }]} onPress={() => router.replace(`/competition/${competition.id}`)}>
            <Ionicons name="checkmark-circle" size={20} color={Colors.textPrimary} />
            <Text style={[styles.joinButtonText, { color: Colors.textPrimary }]}>Already Joined — View Competition</Text>
          </TouchableOpacity>
        ) : isFull ? (
          <View style={[styles.joinButton, { backgroundColor: Colors.textMuted }]}>
            <Ionicons name="close-circle" size={20} color={Colors.surface} />
            <Text style={[styles.joinButtonText, { color: Colors.surface }]}>Competition Full</Text>
          </View>
        ) : (
          <TouchableOpacity style={[styles.joinButton, dynamicStyles.joinButton]} onPress={handleJoin} disabled={joining} activeOpacity={0.85}>
            {joining ? <ActivityIndicator size="small" color={Colors.textPrimary} /> : (
              <>
                <Ionicons name="flash" size={20} color={Colors.textPrimary} />
                <Text style={[styles.joinButtonText, { color: Colors.textPrimary }]}>
                  {effectiveEntryCents === 0 ? "Join Free 🎉" : `Pay ${formatCents(effectiveEntryCents)} & Join`}
                </Text>
              </>
            )}
          </TouchableOpacity>
        )}

        {/* ── Before photo ── */}
        {showBeforePhoto && competition && (
          <View style={[styles.beforePhotoCard, dynamicStyles.beforePhotoCard]}>
            <Text style={[styles.beforePhotoTitle, dynamicStyles.beforePhotoTitle]}>📸 Add a before photo</Text>
            <Text style={[styles.beforePhotoSubtitle, dynamicStyles.beforePhotoSubtitle]}>Optional — share your starting point. Only visible to competition members.</Text>
            {beforePhotoUri ? (
              <View style={styles.beforePhotoPreview}>
                <Image source={{ uri: beforePhotoUri }} style={[styles.beforePhotoImage, dynamicStyles.beforePhotoImage]} />
                <View style={styles.beforePhotoActions}>
                  <TouchableOpacity style={[styles.beforePhotoRetake, dynamicStyles.beforePhotoRetake]} onPress={handlePickBeforePhoto}>
                    <Text style={[styles.beforePhotoRetakeText, dynamicStyles.beforePhotoRetakeText]}>Retake</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.beforePhotoUploadBtn, dynamicStyles.beforePhotoUploadBtn, uploadingPhoto && { opacity: 0.6 }]} onPress={handleUploadBeforePhoto} disabled={uploadingPhoto}>
                    <Text style={[styles.beforePhotoUploadText, { color: Colors.textPrimary }]}>{uploadingPhoto ? "Uploading..." : "Save Photo"}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <TouchableOpacity style={[styles.beforePhotoPickerBtn, dynamicStyles.beforePhotoPickerBtn]} onPress={handlePickBeforePhoto}>
                <Ionicons name="camera-outline" size={28} color={Colors.primary} />
                <Text style={[styles.beforePhotoPickerText, dynamicStyles.beforePhotoPickerText]}>Choose a photo</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.beforePhotoSkip} onPress={() => router.replace(`/competition/${competition.id}`)}>
              <Text style={[styles.beforePhotoSkipText, dynamicStyles.beforePhotoSkipText]}>Skip for now →</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContainer: { flex: 1 },
  scrollContent: { flexGrow: 1, justifyContent: "center", padding: Spacing.xxl },
  centered: { flex: 1, justifyContent: "center", alignItems: "center", padding: Spacing.xxl },
  loadingText: { fontSize: FontSize.md, marginTop: Spacing.lg },
  errorTitle: { fontSize: FontSize.xl, fontWeight: "700", marginTop: Spacing.lg },
  errorSubtitle: { fontSize: FontSize.md, marginTop: Spacing.sm, textAlign: "center" },
  backHomeBtn: { marginTop: Spacing.xxl, paddingHorizontal: Spacing.xxl, paddingVertical: Spacing.md, borderRadius: BorderRadius.lg },
  backHomeBtnText: { color: "#000", fontSize: FontSize.md, fontWeight: "700" },
  card: { borderRadius: BorderRadius.xl, padding: Spacing.xxl },
  inviteBadge: { flexDirection: "row", alignItems: "center", gap: Spacing.sm, alignSelf: "center", marginBottom: Spacing.xxl, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm, borderRadius: BorderRadius.full },
  inviteBadgeText: { fontSize: FontSize.sm, fontWeight: "700" },
  typeBadge: { flexDirection: "row", alignItems: "center", alignSelf: "flex-start", gap: Spacing.xs, paddingHorizontal: Spacing.sm, paddingVertical: Spacing.xs, borderRadius: BorderRadius.sm, marginBottom: Spacing.md },
  typeLabel: { fontSize: FontSize.xs, fontWeight: "600" },
  competitionName: { fontSize: FontSize.xxl, fontWeight: "800", marginBottom: Spacing.sm },
  description: { fontSize: FontSize.md, lineHeight: 22, marginBottom: Spacing.lg },
  detailsGrid: { gap: Spacing.md, marginBottom: Spacing.xxl, paddingTop: Spacing.lg, borderTopWidth: 1 },
  detailItem: { flexDirection: "row", alignItems: "center", gap: Spacing.sm },
  detailText: { fontSize: FontSize.md },
  watchBadge: { flexDirection: "row", alignItems: "center", alignSelf: "flex-start", paddingHorizontal: Spacing.sm, paddingVertical: 3, borderRadius: BorderRadius.full, marginBottom: Spacing.sm, gap: 4 },
  watchBadgeIcon: { fontSize: FontSize.xs },
  watchBadgeText: { fontSize: FontSize.xs, fontWeight: "600" },
  // Promo
  promoSection: { marginBottom: Spacing.lg },
  promoLabel: { fontSize: FontSize.sm, fontWeight: "600", marginBottom: Spacing.sm },
  promoRow: { flexDirection: "row", gap: Spacing.sm },
  promoInput: { flex: 1, borderRadius: BorderRadius.md, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, fontSize: FontSize.md, borderWidth: 1, fontWeight: "700", letterSpacing: 1 },
  promoButton: { paddingHorizontal: Spacing.xl, borderRadius: BorderRadius.md, justifyContent: "center" },
  promoButtonText: { color: "#000", fontWeight: "800", fontSize: FontSize.sm },
  promoButtonRemove: { borderWidth: 1 },
  promoButtonRemoveText: { fontWeight: "600", fontSize: FontSize.sm },
  promoSuccess: { flexDirection: "row", alignItems: "center", gap: Spacing.xs, marginTop: Spacing.sm },
  promoSuccessText: { fontSize: FontSize.sm, fontWeight: "600" },
  promoErrorText: { fontSize: FontSize.sm, marginTop: Spacing.sm },
  // Fee summary
  feesummary: { borderRadius: BorderRadius.md, padding: Spacing.lg, marginBottom: Spacing.xl, borderWidth: 1 },
  feeLine: { flexDirection: "row", justifyContent: "space-between", marginBottom: Spacing.sm },
  feeLabelText: { fontSize: FontSize.sm },
  feeValueText: { fontSize: FontSize.sm, fontWeight: "600" },
  feeValueStrike: { fontSize: FontSize.sm, textDecorationLine: "line-through" },
  feeTotalLine: { borderTopWidth: 1, paddingTop: Spacing.sm, marginBottom: 0 },
  feeTotalLabel: { fontSize: FontSize.md, fontWeight: "700" },
  feeTotalValue: { fontSize: FontSize.md, fontWeight: "900" },
  // Payment
  paymentSection: { marginBottom: Spacing.xxl, gap: Spacing.md },
  paymentSectionTitle: { fontSize: FontSize.lg, fontWeight: "700" },
  paymentOption: { borderWidth: 2, borderRadius: BorderRadius.md, padding: Spacing.lg },
  paymentOptionSelected: {},
  paymentOptionHeader: { flexDirection: "row", alignItems: "center", gap: Spacing.sm, marginBottom: Spacing.xs },
  radioOuter: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, justifyContent: "center", alignItems: "center" },
  radioInner: { width: 10, height: 10, borderRadius: 5 },
  paymentOptionIcon: { fontSize: FontSize.lg },
  paymentOptionTitle: { fontSize: FontSize.md, fontWeight: "700" },
  paymentOptionNote: { fontSize: FontSize.xs, marginLeft: 36 },
  usdcDetails: { marginLeft: 36, marginTop: Spacing.sm },
  addressCopyBtn: { flexDirection: "row", alignItems: "center", gap: Spacing.xs, paddingHorizontal: Spacing.sm, paddingVertical: 4, borderRadius: BorderRadius.sm, alignSelf: "flex-start" },
  usdcAddress: { fontSize: FontSize.sm, fontWeight: "600" },
  // Join button
  joinButton: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: Spacing.sm, paddingVertical: Spacing.lg, borderRadius: BorderRadius.lg },
  joinButtonText: { fontSize: FontSize.md, fontWeight: "800" },
  // Before photo
  beforePhotoCard: { marginTop: Spacing.xxl, padding: Spacing.xl, borderRadius: BorderRadius.lg, borderWidth: 1 },
  beforePhotoTitle: { fontSize: FontSize.lg, fontWeight: "700", marginBottom: Spacing.xs },
  beforePhotoSubtitle: { fontSize: FontSize.sm, lineHeight: 20, marginBottom: Spacing.lg },
  beforePhotoPickerBtn: { alignItems: "center", justifyContent: "center", gap: Spacing.sm, paddingVertical: Spacing.xxl, borderRadius: BorderRadius.lg, borderWidth: 1.5, borderStyle: "dashed" },
  beforePhotoPickerText: { fontSize: FontSize.md, fontWeight: "600" },
  beforePhotoPreview: { gap: Spacing.md },
  beforePhotoImage: { width: "100%", height: 260, borderRadius: BorderRadius.lg },
  beforePhotoActions: { flexDirection: "row", gap: Spacing.md },
  beforePhotoRetake: { flex: 1, alignItems: "center", paddingVertical: Spacing.md, borderRadius: BorderRadius.lg, borderWidth: 1.5 },
  beforePhotoRetakeText: { fontSize: FontSize.md, fontWeight: "600" },
  beforePhotoUploadBtn: { flex: 1, alignItems: "center", paddingVertical: Spacing.md, borderRadius: BorderRadius.lg },
  beforePhotoUploadText: { fontSize: FontSize.md, fontWeight: "700" },
  beforePhotoSkip: { alignSelf: "center", marginTop: Spacing.lg, paddingVertical: Spacing.sm },
  beforePhotoSkipText: { fontSize: FontSize.md, fontWeight: "600" },
});
