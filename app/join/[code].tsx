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
  Colors,
  Spacing,
  BorderRadius,
  FontSize,
  Shadow,
  CompetitionTypes,
} from "@/constants/theme";
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
    return <View style={styles.centered}><ActivityIndicator size="large" color={Colors.primary} /><Text style={styles.loadingText}>Finding competition...</Text></View>;
  }

  if (!competition) {
    return (
      <View style={styles.centered}>
        <Ionicons name="alert-circle-outline" size={64} color={Colors.textMuted} />
        <Text style={styles.errorTitle}>Competition Not Found</Text>
        <Text style={styles.errorSubtitle}>The invite code "{code}" doesn't match any competition.</Text>
        <TouchableOpacity style={styles.backHomeBtn} onPress={() => router.replace("/(tabs)")}><Text style={styles.backHomeBtnText}>Go Home</Text></TouchableOpacity>
      </View>
    );
  }

  const typeInfo = CompetitionTypes[competition.type] ?? CompetitionTypes.custom;
  const isFull = participantCount >= competition.max_participants;
  const hasFee = competition.entry_fee_cents > 0;

  return (
    <ScrollView style={styles.scrollContainer} contentContainerStyle={styles.scrollContent}>
      <View style={styles.card}>
        {/* Invite badge */}
        <View style={styles.inviteBadge}>
          <Ionicons name="mail-open" size={20} color={Colors.primary} />
          <Text style={styles.inviteBadgeText}>You've been invited!</Text>
        </View>

        <View style={[styles.typeBadge, { backgroundColor: typeInfo.color + "18" }]}>
          <Text>{typeInfo.emoji}</Text>
          <Text style={[styles.typeLabel, { color: typeInfo.color }]}>{typeInfo.label}</Text>
        </View>

        <View style={[styles.watchBadge, { backgroundColor: competition.requires_watch ? "#F59E0B18" : "#22C55E18" }]}>
          <Text style={styles.watchBadgeIcon}>{competition.requires_watch ? "⌚" : "📱"}</Text>
          <Text style={[styles.watchBadgeText, { color: competition.requires_watch ? "#F59E0B" : "#22C55E" }]}>
            {competition.requires_watch ? "Requires Apple Watch" : "iPhone Compatible"}
          </Text>
        </View>

        <Text style={styles.competitionName}>{competition.name}</Text>
        {competition.description && <Text style={styles.description}>{competition.description}</Text>}

        {/* Details */}
        <View style={styles.detailsGrid}>
          <View style={styles.detailItem}>
            <Ionicons name="calendar" size={18} color={Colors.textMuted} />
            <Text style={styles.detailText}>{new Date(competition.start_date).toLocaleDateString()} — {new Date(competition.end_date).toLocaleDateString()}</Text>
          </View>
          <View style={styles.detailItem}>
            <Ionicons name="people" size={18} color={Colors.textMuted} />
            <Text style={styles.detailText}>{participantCount}/{competition.max_participants} players</Text>
          </View>
          <View style={styles.detailItem}>
            <Ionicons name="cash" size={18} color={Colors.textMuted} />
            <Text style={styles.detailText}>Entry: {formatCents(competition.entry_fee_cents)}</Text>
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
            <Text style={styles.promoLabel}>Have a promo code?</Text>
            <View style={styles.promoRow}>
              <TextInput
                style={styles.promoInput}
                placeholder="e.g. PODIUM10"
                placeholderTextColor={Colors.textMuted}
                value={promoInput}
                onChangeText={(t) => { setPromoInput(t.toUpperCase()); setPromoError(""); setPromoApplied(false); setPromoDiscount(0); setPromoMessage(""); }}
                autoCapitalize="characters"
                editable={!promoApplied}
              />
              {promoApplied ? (
                <TouchableOpacity style={[styles.promoButton, styles.promoButtonRemove]} onPress={() => { setPromoApplied(false); setPromoDiscount(0); setPromoMessage(""); setPromoInput(""); }}>
                  <Text style={styles.promoButtonRemoveText}>Remove</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity style={[styles.promoButton, !promoInput.trim() && { opacity: 0.5 }]} onPress={handleApplyPromo} disabled={!promoInput.trim() || promoLoading}>
                  <Text style={styles.promoButtonText}>{promoLoading ? "..." : "Apply"}</Text>
                </TouchableOpacity>
              )}
            </View>
            {promoMessage ? (
              <View style={styles.promoSuccess}>
                <Ionicons name="checkmark-circle" size={16} color={Colors.success} />
                <Text style={styles.promoSuccessText}>{promoMessage}</Text>
              </View>
            ) : null}
            {promoError ? (
              <Text style={styles.promoErrorText}>{promoError}</Text>
            ) : null}
          </View>
        )}

        {/* ── Entry fee summary ── */}
        {hasFee && !alreadyJoined && !isFull && (
          <View style={styles.feesummary}>
            {promoApplied && promoDiscount > 0 && (
              <View style={styles.feeLine}>
                <Text style={styles.feeLabelText}>Original fee</Text>
                <Text style={styles.feeValueStrike}>{formatCents(competition.entry_fee_cents)}</Text>
              </View>
            )}
            {promoApplied && promoDiscount > 0 && (
              <View style={styles.feeLine}>
                <Text style={styles.feeLabelText}>Promo ({promoInput})</Text>
                <Text style={[styles.feeValueText, { color: Colors.success }]}>-{formatCents(promoDiscount)}</Text>
              </View>
            )}
            <View style={[styles.feeLine, styles.feeTotalLine]}>
              <Text style={styles.feeTotalLabel}>You pay</Text>
              <Text style={[styles.feeTotalValue, effectiveEntryCents === 0 && { color: Colors.success }]}>
                {effectiveEntryCents === 0 ? "FREE 🎉" : formatCents(effectiveEntryCents)}
              </Text>
            </View>
          </View>
        )}

        {/* ── Payment method ── */}
        {hasFee && effectiveEntryCents > 0 && !alreadyJoined && !isFull && (
          <View style={styles.paymentSection}>
            <Text style={styles.paymentSectionTitle}>Payment Method</Text>
            <TouchableOpacity style={[styles.paymentOption, paymentMethod === "stripe" && styles.paymentOptionSelected]} onPress={() => setPaymentMethod("stripe")} activeOpacity={0.7}>
              <View style={styles.paymentOptionHeader}>
                <View style={styles.radioOuter}>{paymentMethod === "stripe" && <View style={styles.radioInner} />}</View>
                <Text style={styles.paymentOptionIcon}>💳</Text>
                <Text style={styles.paymentOptionTitle}>Card / Apple Pay</Text>
              </View>
              <Text style={styles.paymentOptionNote}>Secure · Instant · Refunded if cancelled</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.paymentOption, paymentMethod === "usdc" && styles.paymentOptionSelected]} onPress={() => setPaymentMethod("usdc")} activeOpacity={0.7}>
              <View style={styles.paymentOptionHeader}>
                <View style={styles.radioOuter}>{paymentMethod === "usdc" && <View style={styles.radioInner} />}</View>
                <Text style={styles.paymentOptionIcon}>🔵</Text>
                <Text style={styles.paymentOptionTitle}>USDC (Base)</Text>
              </View>
              {paymentMethod === "usdc" && (
                <View style={styles.usdcDetails}>
                  <TouchableOpacity style={styles.addressCopyBtn} onPress={copyEscrowAddress}>
                    <Text style={styles.usdcAddress}>{`${getEscrowAddress().slice(0, 8)}...${getEscrowAddress().slice(-4)}`}</Text>
                    <Ionicons name={copied ? "checkmark" : "copy-outline"} size={14} color={Colors.primary} />
                  </TouchableOpacity>
                </View>
              )}
              <Text style={styles.paymentOptionNote}>⚡ Zero fees · Instant payout</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── Join button ── */}
        {alreadyJoined ? (
          <TouchableOpacity style={[styles.joinButton, { backgroundColor: Colors.success }]} onPress={() => router.replace(`/competition/${competition.id}`)}>
            <Ionicons name="checkmark-circle" size={20} color="#000" />
            <Text style={[styles.joinButtonText, { color: '#000' }]}>Already Joined — View Competition</Text>
          </TouchableOpacity>
        ) : isFull ? (
          <View style={[styles.joinButton, { backgroundColor: Colors.textMuted }]}>
            <Ionicons name="close-circle" size={20} color="#fff" />
            <Text style={styles.joinButtonText}>Competition Full</Text>
          </View>
        ) : (
          <TouchableOpacity style={styles.joinButton} onPress={handleJoin} disabled={joining} activeOpacity={0.85}>
            {joining ? <ActivityIndicator size="small" color="#000" /> : (
              <>
                <Ionicons name="flash" size={20} color="#000" />
                <Text style={[styles.joinButtonText, { color: '#000' }]}>
                  {effectiveEntryCents === 0 ? "Join Free 🎉" : `Pay ${formatCents(effectiveEntryCents)} & Join`}
                </Text>
              </>
            )}
          </TouchableOpacity>
        )}

        {/* ── Before photo ── */}
        {showBeforePhoto && competition && (
          <View style={styles.beforePhotoCard}>
            <Text style={styles.beforePhotoTitle}>📸 Add a before photo</Text>
            <Text style={styles.beforePhotoSubtitle}>Optional — share your starting point. Only visible to competition members.</Text>
            {beforePhotoUri ? (
              <View style={styles.beforePhotoPreview}>
                <Image source={{ uri: beforePhotoUri }} style={styles.beforePhotoImage} />
                <View style={styles.beforePhotoActions}>
                  <TouchableOpacity style={styles.beforePhotoRetake} onPress={handlePickBeforePhoto}><Text style={styles.beforePhotoRetakeText}>Retake</Text></TouchableOpacity>
                  <TouchableOpacity style={[styles.beforePhotoUploadBtn, uploadingPhoto && { opacity: 0.6 }]} onPress={handleUploadBeforePhoto} disabled={uploadingPhoto}>
                    <Text style={styles.beforePhotoUploadText}>{uploadingPhoto ? "Uploading..." : "Save Photo"}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <TouchableOpacity style={styles.beforePhotoPickerBtn} onPress={handlePickBeforePhoto}>
                <Ionicons name="camera-outline" size={28} color={Colors.primary} />
                <Text style={styles.beforePhotoPickerText}>Choose a photo</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.beforePhotoSkip} onPress={() => router.replace(`/competition/${competition.id}`)}>
              <Text style={styles.beforePhotoSkipText}>Skip for now →</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContainer: { flex: 1, backgroundColor: Colors.background },
  scrollContent: { flexGrow: 1, justifyContent: "center", padding: Spacing.xxl },
  centered: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: Colors.background, padding: Spacing.xxl },
  loadingText: { fontSize: FontSize.md, color: Colors.textSecondary, marginTop: Spacing.lg },
  errorTitle: { fontSize: FontSize.xl, fontWeight: "700", color: Colors.textPrimary, marginTop: Spacing.lg },
  errorSubtitle: { fontSize: FontSize.md, color: Colors.textSecondary, marginTop: Spacing.sm, textAlign: "center" },
  backHomeBtn: { marginTop: Spacing.xxl, paddingHorizontal: Spacing.xxl, paddingVertical: Spacing.md, backgroundColor: Colors.primary, borderRadius: BorderRadius.lg },
  backHomeBtnText: { color: "#000", fontSize: FontSize.md, fontWeight: "700" },
  card: { backgroundColor: Colors.surface, borderRadius: BorderRadius.xl, padding: Spacing.xxl, ...Shadow.lg },
  inviteBadge: { flexDirection: "row", alignItems: "center", gap: Spacing.sm, alignSelf: "center", marginBottom: Spacing.xxl, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm, backgroundColor: Colors.primaryGlow, borderRadius: BorderRadius.full },
  inviteBadgeText: { fontSize: FontSize.sm, fontWeight: "700", color: Colors.primary },
  typeBadge: { flexDirection: "row", alignItems: "center", alignSelf: "flex-start", gap: Spacing.xs, paddingHorizontal: Spacing.sm, paddingVertical: Spacing.xs, borderRadius: BorderRadius.sm, marginBottom: Spacing.md },
  typeLabel: { fontSize: FontSize.xs, fontWeight: "600" },
  competitionName: { fontSize: FontSize.xxl, fontWeight: "800", color: Colors.textPrimary, marginBottom: Spacing.sm },
  description: { fontSize: FontSize.md, color: Colors.textSecondary, lineHeight: 22, marginBottom: Spacing.lg },
  detailsGrid: { gap: Spacing.md, marginBottom: Spacing.xxl, paddingTop: Spacing.lg, borderTopWidth: 1, borderTopColor: Colors.borderLight },
  detailItem: { flexDirection: "row", alignItems: "center", gap: Spacing.sm },
  detailText: { fontSize: FontSize.md, color: Colors.textPrimary },
  watchBadge: { flexDirection: "row", alignItems: "center", alignSelf: "flex-start", paddingHorizontal: Spacing.sm, paddingVertical: 3, borderRadius: BorderRadius.full, marginBottom: Spacing.sm, gap: 4 },
  watchBadgeIcon: { fontSize: FontSize.xs },
  watchBadgeText: { fontSize: FontSize.xs, fontWeight: "600" },
  // Promo
  promoSection: { marginBottom: Spacing.lg },
  promoLabel: { fontSize: FontSize.sm, fontWeight: "600", color: Colors.textSecondary, marginBottom: Spacing.sm },
  promoRow: { flexDirection: "row", gap: Spacing.sm },
  promoInput: { flex: 1, backgroundColor: Colors.surfaceLight, borderRadius: BorderRadius.md, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, fontSize: FontSize.md, color: Colors.textPrimary, borderWidth: 1, borderColor: Colors.border, fontWeight: "700", letterSpacing: 1 },
  promoButton: { backgroundColor: Colors.primary, paddingHorizontal: Spacing.xl, borderRadius: BorderRadius.md, justifyContent: "center" },
  promoButtonText: { color: "#000", fontWeight: "800", fontSize: FontSize.sm },
  promoButtonRemove: { backgroundColor: Colors.surfaceLight, borderWidth: 1, borderColor: Colors.border },
  promoButtonRemoveText: { color: Colors.textSecondary, fontWeight: "600", fontSize: FontSize.sm },
  promoSuccess: { flexDirection: "row", alignItems: "center", gap: Spacing.xs, marginTop: Spacing.sm },
  promoSuccessText: { fontSize: FontSize.sm, color: Colors.success, fontWeight: "600" },
  promoErrorText: { fontSize: FontSize.sm, color: Colors.error, marginTop: Spacing.sm },
  // Fee summary
  feeummary: { backgroundColor: Colors.background, borderRadius: BorderRadius.md, padding: Spacing.lg, marginBottom: Spacing.xl, borderWidth: 1, borderColor: Colors.border },
  feesummary: { backgroundColor: Colors.background, borderRadius: BorderRadius.md, padding: Spacing.lg, marginBottom: Spacing.xl, borderWidth: 1, borderColor: Colors.border },
  feeLine: { flexDirection: "row", justifyContent: "space-between", marginBottom: Spacing.sm },
  feeLabelText: { fontSize: FontSize.sm, color: Colors.textSecondary },
  feeValueText: { fontSize: FontSize.sm, fontWeight: "600", color: Colors.textPrimary },
  feeValueStrike: { fontSize: FontSize.sm, color: Colors.textMuted, textDecorationLine: "line-through" },
  feeTotalLine: { borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: Spacing.sm, marginBottom: 0 },
  feeTotalLabel: { fontSize: FontSize.md, fontWeight: "700", color: Colors.textPrimary },
  feeTotalValue: { fontSize: FontSize.md, fontWeight: "900", color: Colors.primary },
  // Payment
  paymentSection: { marginBottom: Spacing.xxl, gap: Spacing.md },
  paymentSectionTitle: { fontSize: FontSize.lg, fontWeight: "700", color: Colors.textPrimary },
  paymentOption: { borderWidth: 2, borderColor: Colors.border, borderRadius: BorderRadius.md, padding: Spacing.lg },
  paymentOptionSelected: { borderColor: Colors.primary, backgroundColor: Colors.primaryGlow },
  paymentOptionHeader: { flexDirection: "row", alignItems: "center", gap: Spacing.sm, marginBottom: Spacing.xs },
  radioOuter: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: Colors.textMuted, justifyContent: "center", alignItems: "center" },
  radioInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.primary },
  paymentOptionIcon: { fontSize: FontSize.lg },
  paymentOptionTitle: { fontSize: FontSize.md, fontWeight: "700", color: Colors.textPrimary },
  paymentOptionNote: { fontSize: FontSize.xs, color: Colors.textMuted, marginLeft: 36 },
  usdcDetails: { marginLeft: 36, marginTop: Spacing.sm },
  addressCopyBtn: { flexDirection: "row", alignItems: "center", gap: Spacing.xs, paddingHorizontal: Spacing.sm, paddingVertical: 4, backgroundColor: Colors.primaryGlow, borderRadius: BorderRadius.sm, alignSelf: "flex-start" },
  usdcAddress: { fontSize: FontSize.sm, fontWeight: "600", color: Colors.primary },
  // Join button
  joinButton: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: Spacing.sm, backgroundColor: Colors.primary, paddingVertical: Spacing.lg, borderRadius: BorderRadius.lg, ...Shadow.gold },
  joinButtonText: { color: "#fff", fontSize: FontSize.md, fontWeight: "800" },
  // Before photo
  beforePhotoCard: { marginTop: Spacing.xxl, padding: Spacing.xl, backgroundColor: Colors.background, borderRadius: BorderRadius.lg, borderWidth: 1, borderColor: Colors.border },
  beforePhotoTitle: { fontSize: FontSize.lg, fontWeight: "700", color: Colors.textPrimary, marginBottom: Spacing.xs },
  beforePhotoSubtitle: { fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 20, marginBottom: Spacing.lg },
  beforePhotoPickerBtn: { alignItems: "center", justifyContent: "center", gap: Spacing.sm, paddingVertical: Spacing.xxl, borderRadius: BorderRadius.lg, borderWidth: 1.5, borderColor: Colors.primaryGlow, borderStyle: "dashed", backgroundColor: Colors.primaryGlow },
  beforePhotoPickerText: { fontSize: FontSize.md, fontWeight: "600", color: Colors.primary },
  beforePhotoPreview: { gap: Spacing.md },
  beforePhotoImage: { width: "100%", height: 260, borderRadius: BorderRadius.lg, backgroundColor: Colors.surface },
  beforePhotoActions: { flexDirection: "row", gap: Spacing.md },
  beforePhotoRetake: { flex: 1, alignItems: "center", paddingVertical: Spacing.md, borderRadius: BorderRadius.lg, borderWidth: 1.5, borderColor: Colors.border },
  beforePhotoRetakeText: { fontSize: FontSize.md, fontWeight: "600", color: Colors.textSecondary },
  beforePhotoUploadBtn: { flex: 1, alignItems: "center", paddingVertical: Spacing.md, borderRadius: BorderRadius.lg, backgroundColor: Colors.primary },
  beforePhotoUploadText: { fontSize: FontSize.md, fontWeight: "700", color: "#000" },
  beforePhotoSkip: { alignSelf: "center", marginTop: Spacing.lg, paddingVertical: Spacing.sm },
  beforePhotoSkipText: { fontSize: FontSize.md, color: Colors.textMuted, fontWeight: "600" },
});
