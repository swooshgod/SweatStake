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
import { checkAppleWatchPaired } from "@/lib/healthkit";
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
    ? Math.ceil(
        (new Date(competition.end_date).getTime() -
          new Date(competition.start_date).getTime()) /
          (1000 * 60 * 60 * 24)
      )
    : 0;

  const shouldOfferBeforePhoto =
    competition?.allow_before_photo === true && competitionDurationDays >= 14;

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

      const { error: uploadError } = await supabase.storage
        .from("before-photos")
        .upload(path, blob, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("before-photos")
        .getPublicUrl(path);

      await supabase.from("before_photos").upsert(
        {
          competition_id: competition.id,
          user_id: profile.id,
          photo_url: urlData.publicUrl,
        },
        { onConflict: "competition_id,user_id" }
      );

      Alert.alert("Photo saved!", "Your before photo has been uploaded.", [
        {
          text: "View Competition",
          onPress: () => router.replace(`/competition/${competition.id}`),
        },
      ]);
    } catch {
      Alert.alert("Upload failed", "Could not upload your photo. Try again.");
    } finally {
      setUploadingPhoto(false);
    }
  };

  const onJoinSuccess = () => {
    if (shouldOfferBeforePhoto) {
      setShowBeforePhoto(true);
    }
  };

  const copyEscrowAddress = async () => {
    await Clipboard.setStringAsync(getEscrowAddress());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleJoin = async () => {
    if (!isAuthenticated) {
      router.push("/(auth)/welcome?modal=1");
      return;
    }

    if (!profile || !competition) return;

    // Check Apple Watch requirement
    if (competition.requires_watch) {
      const hasPaired = await checkAppleWatchPaired();
      if (!hasPaired) {
        if (__DEV__) {
          Alert.alert(
            "Apple Watch Required",
            "This competition requires Apple Watch for accurate tracking. No Watch detected — proceeding anyway (dev mode)."
          );
        } else {
          Alert.alert(
            "Apple Watch Required",
            "This competition requires Apple Watch for accurate tracking. Connect an Apple Watch to join.",
            [{ text: "OK" }]
          );
          return;
        }
      }
    }

    // Handle paid competitions
    if (competition.entry_fee_cents > 0) {
      if (paymentMethod === "stripe") {
        // TODO: Call edge function to create PaymentIntent,
        // then confirm with Stripe SDK using the clientSecret.
        // On success, insert participant with paid: true and payment_intent_id.
        Alert.alert(
          "Stripe Payment",
          "Card payment flow coming soon. Payment intents are created via Supabase Edge Functions."
        );
        return;
      }

      if (paymentMethod === "usdc") {
        // USDC: participant sends entry fee to escrow wallet manually,
        // then we insert them as pending verification.
        // A server-side job verifies on-chain payment.
        setJoining(true);
        try {
          const { error } = await supabase.from("participants").insert({
            competition_id: competition.id,
            user_id: profile.id,
            paid: false, // marked paid after on-chain verification
          });

          if (error) throw error;

          if (shouldOfferBeforePhoto) {
            Alert.alert(
              "USDC Payment Pending",
              `Send ${formatCents(competition.entry_fee_cents)} USDC to the escrow address on Base network. Your spot is reserved.`,
              [{ text: "OK", onPress: onJoinSuccess }]
            );
          } else {
            Alert.alert(
              "USDC Payment Pending",
              `Send ${formatCents(competition.entry_fee_cents)} USDC to the escrow address on Base network. Your spot is reserved — payment will be verified on-chain.`,
              [
                {
                  text: "View Competition",
                  onPress: () =>
                    router.replace(`/competition/${competition.id}`),
                },
              ]
            );
          }
        } catch {
          Alert.alert(
            "Error",
            "Failed to join. You may already be a participant."
          );
        } finally {
          setJoining(false);
        }
        return;
      }
    }

    // Free competition — join immediately
    setJoining(true);
    try {
      const { error } = await supabase.from("participants").insert({
        competition_id: competition.id,
        user_id: profile.id,
        paid: true,
      });

      if (error) throw error;

      if (shouldOfferBeforePhoto) {
        Alert.alert("Welcome!", `You've joined "${competition.name}"!`, [
          { text: "OK", onPress: onJoinSuccess },
        ]);
      } else {
        Alert.alert("Welcome!", `You've joined "${competition.name}"!`, [
          {
            text: "Let's go!",
            onPress: () => router.replace(`/competition/${competition.id}`),
          },
        ]);
      }
    } catch {
      Alert.alert(
        "Error",
        "Failed to join. You may already be a participant."
      );
    } finally {
      setJoining(false);
    }
  };

  // ── Loading / Error states ──────────────────────────────────────────────

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Finding competition...</Text>
      </View>
    );
  }

  if (!competition) {
    return (
      <View style={styles.centered}>
        <Ionicons
          name="alert-circle-outline"
          size={64}
          color={Colors.textMuted}
        />
        <Text style={styles.errorTitle}>Competition Not Found</Text>
        <Text style={styles.errorSubtitle}>
          The invite code "{code}" doesn't match any competition.
        </Text>
        <TouchableOpacity
          style={styles.backHomeBtn}
          onPress={() => router.replace("/(tabs)")}
        >
          <Text style={styles.backHomeBtnText}>Go Home</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const typeInfo =
    CompetitionTypes[competition.type] ?? CompetitionTypes.custom;
  const isFull = participantCount >= competition.max_participants;
  const hasFee = competition.entry_fee_cents > 0;
  const escrowShort = `${getEscrowAddress().slice(0, 8)}...${getEscrowAddress().slice(-4)}`;

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <ScrollView
      style={styles.scrollContainer}
      contentContainerStyle={styles.scrollContent}
    >
      <View style={styles.card}>
        {/* Invite badge */}
        <View style={styles.inviteBadge}>
          <Ionicons name="mail-open" size={20} color={Colors.primary} />
          <Text style={styles.inviteBadgeText}>You've been invited!</Text>
        </View>

        {/* Competition type + watch badges */}
        <View
          style={[styles.typeBadge, { backgroundColor: typeInfo.color + "18" }]}
        >
          <Text>{typeInfo.emoji}</Text>
          <Text style={[styles.typeLabel, { color: typeInfo.color }]}>
            {typeInfo.label}
          </Text>
        </View>

        <View
          style={[
            styles.watchBadge,
            {
              backgroundColor: competition.requires_watch
                ? "#F59E0B18"
                : "#22C55E18",
            },
          ]}
        >
          <Text style={styles.watchBadgeIcon}>
            {competition.requires_watch ? "\u231A" : "\uD83D\uDCF1"}
          </Text>
          <Text
            style={[
              styles.watchBadgeText,
              {
                color: competition.requires_watch ? "#F59E0B" : "#22C55E",
              },
            ]}
          >
            {competition.requires_watch
              ? "Requires Apple Watch"
              : "iPhone Compatible"}
          </Text>
        </View>

        <Text style={styles.competitionName}>{competition.name}</Text>
        {competition.description && (
          <Text style={styles.description}>{competition.description}</Text>
        )}

        {/* Details */}
        <View style={styles.detailsGrid}>
          <View style={styles.detailItem}>
            <Ionicons name="calendar" size={18} color={Colors.textMuted} />
            <Text style={styles.detailText}>
              {new Date(competition.start_date).toLocaleDateString()} —{" "}
              {new Date(competition.end_date).toLocaleDateString()}
            </Text>
          </View>
          <View style={styles.detailItem}>
            <Ionicons name="people" size={18} color={Colors.textMuted} />
            <Text style={styles.detailText}>
              {participantCount}/{competition.max_participants} players
            </Text>
          </View>
          <View style={styles.detailItem}>
            <Ionicons name="cash" size={18} color={Colors.textMuted} />
            <Text style={styles.detailText}>
              Entry: {formatCents(competition.entry_fee_cents)}
            </Text>
          </View>
          <View style={styles.detailItem}>
            <Ionicons name="trophy" size={18} color={Colors.accent} />
            <Text
              style={[
                styles.detailText,
                { color: Colors.accent, fontWeight: "700" },
              ]}
            >
              Prize Pool: {competition.prize_pool_cents > 0 ? formatCents(competition.prize_pool_cents) : '$0.00'}
            </Text>
          </View>
        </View>

        {/* ── Payment method selector (only for paid competitions) ─── */}
        {hasFee && !alreadyJoined && !isFull && (
          <View style={styles.paymentSection}>
            <Text style={styles.paymentSectionTitle}>Payment Method</Text>

            {/* Stripe option */}
            <TouchableOpacity
              style={[
                styles.paymentOption,
                paymentMethod === "stripe" && styles.paymentOptionSelected,
              ]}
              onPress={() => setPaymentMethod("stripe")}
              activeOpacity={0.7}
            >
              <View style={styles.paymentOptionHeader}>
                <View style={styles.radioOuter}>
                  {paymentMethod === "stripe" && (
                    <View style={styles.radioInner} />
                  )}
                </View>
                <Text style={styles.paymentOptionIcon}>{"\uD83D\uDCB3"}</Text>
                <Text style={styles.paymentOptionTitle}>
                  Pay with Card / Apple Pay
                </Text>
              </View>
              <Text style={styles.paymentOptionFee}>
                Entry fee: {formatCents(competition.entry_fee_cents)}
              </Text>
              <Text style={styles.paymentOptionNote}>
                Secure · Instant · Refunded if competition cancelled
              </Text>
            </TouchableOpacity>

            {/* USDC option */}
            <TouchableOpacity
              style={[
                styles.paymentOption,
                paymentMethod === "usdc" && styles.paymentOptionSelected,
              ]}
              onPress={() => setPaymentMethod("usdc")}
              activeOpacity={0.7}
            >
              <View style={styles.paymentOptionHeader}>
                <View style={styles.radioOuter}>
                  {paymentMethod === "usdc" && (
                    <View style={styles.radioInner} />
                  )}
                </View>
                <Text style={styles.paymentOptionIcon}>{"\uD83D\uDD35"}</Text>
                <Text style={styles.paymentOptionTitle}>
                  Pay with USDC (Base)
                </Text>
              </View>
              <Text style={styles.paymentOptionFee}>
                Entry fee: {formatCents(competition.entry_fee_cents)} USDC
              </Text>

              {paymentMethod === "usdc" && (
                <View style={styles.usdcDetails}>
                  <View style={styles.usdcRow}>
                    <Text style={styles.usdcLabel}>Send to:</Text>
                    <TouchableOpacity
                      style={styles.addressCopyBtn}
                      onPress={copyEscrowAddress}
                    >
                      <Text style={styles.usdcAddress}>{escrowShort}</Text>
                      <Ionicons
                        name={copied ? "checkmark" : "copy-outline"}
                        size={14}
                        color={Colors.primary}
                      />
                    </TouchableOpacity>
                  </View>
                  <View style={styles.usdcRow}>
                    <Text style={styles.usdcLabel}>Network:</Text>
                    <Text style={styles.usdcValue}>Base</Text>
                  </View>
                </View>
              )}

              <Text style={styles.paymentOptionNote}>
                {"\u26A1"} Zero fees · Instant payout
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── Join / status button ─────────────────────────────────── */}
        {alreadyJoined ? (
          <TouchableOpacity
            style={[styles.joinButton, { backgroundColor: Colors.success }]}
            onPress={() => router.replace(`/competition/${competition.id}`)}
          >
            <Ionicons name="checkmark-circle" size={20} color="#fff" />
            <Text style={styles.joinButtonText}>
              Already Joined — View Competition
            </Text>
          </TouchableOpacity>
        ) : isFull ? (
          <View
            style={[styles.joinButton, { backgroundColor: Colors.textMuted }]}
          >
            <Ionicons name="close-circle" size={20} color="#fff" />
            <Text style={styles.joinButtonText}>Competition Full</Text>
          </View>
        ) : (
          <TouchableOpacity
            style={styles.joinButton}
            onPress={handleJoin}
            disabled={joining}
          >
            <Ionicons name="flash" size={20} color="#fff" />
            <Text style={styles.joinButtonText}>
              {joining
                ? "Joining..."
                : hasFee
                  ? paymentMethod === "stripe"
                    ? `Pay ${formatCents(competition.entry_fee_cents)}`
                    : `I've Sent ${formatCents(competition.entry_fee_cents)} USDC`
                  : "Join Competition — Free"}
            </Text>
          </TouchableOpacity>
        )}

        {/* ── Before photo card (post-join) ──────────────────────── */}
        {showBeforePhoto && competition && (
          <View style={styles.beforePhotoCard}>
            <Text style={styles.beforePhotoTitle}>
              {"\uD83D\uDCF8"} Add a before photo
            </Text>
            <Text style={styles.beforePhotoSubtitle}>
              Optional — share your starting point. Only visible to competition
              members.
            </Text>

            {beforePhotoUri ? (
              <View style={styles.beforePhotoPreview}>
                <Image
                  source={{ uri: beforePhotoUri }}
                  style={styles.beforePhotoImage}
                />
                <View style={styles.beforePhotoActions}>
                  <TouchableOpacity
                    style={styles.beforePhotoRetake}
                    onPress={handlePickBeforePhoto}
                  >
                    <Text style={styles.beforePhotoRetakeText}>Retake</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.beforePhotoUploadBtn,
                      uploadingPhoto && { opacity: 0.6 },
                    ]}
                    onPress={handleUploadBeforePhoto}
                    disabled={uploadingPhoto}
                  >
                    <Text style={styles.beforePhotoUploadText}>
                      {uploadingPhoto ? "Uploading..." : "Save Photo"}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.beforePhotoPickerBtn}
                onPress={handlePickBeforePhoto}
              >
                <Ionicons
                  name="camera-outline"
                  size={28}
                  color={Colors.primary}
                />
                <Text style={styles.beforePhotoPickerText}>
                  Choose a photo
                </Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={styles.beforePhotoSkip}
              onPress={() =>
                router.replace(`/competition/${competition.id}`)
              }
            >
              <Text style={styles.beforePhotoSkipText}>
                Skip for now {"\u2192"}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

// ── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  scrollContainer: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    padding: Spacing.xxl,
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: Colors.background,
    padding: Spacing.xxl,
  },
  loadingText: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
    marginTop: Spacing.lg,
  },
  errorTitle: {
    fontSize: FontSize.xl,
    fontWeight: "700",
    color: Colors.textPrimary,
    marginTop: Spacing.lg,
  },
  errorSubtitle: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
    marginTop: Spacing.sm,
    textAlign: "center",
  },
  backHomeBtn: {
    marginTop: Spacing.xxl,
    paddingHorizontal: Spacing.xxl,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.lg,
  },
  backHomeBtnText: {
    color: "#fff",
    fontSize: FontSize.md,
    fontWeight: "700",
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.xxl,
    ...Shadow.lg,
  },
  inviteBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    alignSelf: "center",
    marginBottom: Spacing.xxl,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.primary + "10",
    borderRadius: BorderRadius.full,
  },
  inviteBadgeText: {
    fontSize: FontSize.sm,
    fontWeight: "700",
    color: Colors.primary,
  },
  typeBadge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
    marginBottom: Spacing.md,
  },
  typeLabel: {
    fontSize: FontSize.xs,
    fontWeight: "600",
  },
  competitionName: {
    fontSize: FontSize.xxl,
    fontWeight: "800",
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
  },
  description: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
    lineHeight: 22,
    marginBottom: Spacing.lg,
  },
  detailsGrid: {
    gap: Spacing.md,
    marginBottom: Spacing.xxl,
    paddingTop: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
  detailItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  detailText: {
    fontSize: FontSize.md,
    color: Colors.textPrimary,
  },

  // ── Payment section ───────────────────────────────────────────
  paymentSection: {
    marginBottom: Spacing.xxl,
    gap: Spacing.md,
  },
  paymentSectionTitle: {
    fontSize: FontSize.lg,
    fontWeight: "700",
    color: Colors.textPrimary,
    marginBottom: Spacing.xs,
  },
  paymentOption: {
    borderWidth: 2,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    padding: Spacing.lg,
  },
  paymentOptionSelected: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primary + "06",
  },
  paymentOptionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: Colors.textMuted,
    justifyContent: "center",
    alignItems: "center",
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.primary,
  },
  paymentOptionIcon: {
    fontSize: FontSize.lg,
  },
  paymentOptionTitle: {
    fontSize: FontSize.md,
    fontWeight: "700",
    color: Colors.textPrimary,
  },
  paymentOptionFee: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginLeft: 36,
    marginBottom: 2,
  },
  paymentOptionNote: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    marginLeft: 36,
  },

  // ── USDC details ──────────────────────────────────────────────
  usdcDetails: {
    marginLeft: 36,
    marginTop: Spacing.sm,
    marginBottom: Spacing.sm,
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.sm,
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  usdcRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  usdcLabel: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
  },
  usdcValue: {
    fontSize: FontSize.sm,
    fontWeight: "600",
    color: Colors.textPrimary,
  },
  addressCopyBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    backgroundColor: Colors.primary + "10",
    borderRadius: BorderRadius.sm,
  },
  usdcAddress: {
    fontSize: FontSize.sm,
    fontWeight: "600",
    color: Colors.primary,
    fontFamily: "monospace",
  },

  // ── Join button ───────────────────────────────────────────────
  joinButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    backgroundColor: Colors.primary,
    paddingVertical: Spacing.lg,
    borderRadius: BorderRadius.lg,
    ...Shadow.md,
  },
  joinButtonText: {
    color: "#fff",
    fontSize: FontSize.md,
    fontWeight: "700",
  },
  // ── Before photo styles ──────────────────────────────────────
  beforePhotoCard: {
    marginTop: Spacing.xxl,
    padding: Spacing.xl,
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  beforePhotoTitle: {
    fontSize: FontSize.lg,
    fontWeight: "700",
    color: Colors.textPrimary,
    marginBottom: Spacing.xs,
  },
  beforePhotoSubtitle: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    lineHeight: 20,
    marginBottom: Spacing.lg,
  },
  beforePhotoPickerBtn: {
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.xxl,
    borderRadius: BorderRadius.lg,
    borderWidth: 1.5,
    borderColor: Colors.primary + "40",
    borderStyle: "dashed",
    backgroundColor: Colors.primary + "08",
  },
  beforePhotoPickerText: {
    fontSize: FontSize.md,
    fontWeight: "600",
    color: Colors.primary,
  },
  beforePhotoPreview: {
    gap: Spacing.md,
  },
  beforePhotoImage: {
    width: "100%",
    height: 260,
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.surface,
  },
  beforePhotoActions: {
    flexDirection: "row",
    gap: Spacing.md,
  },
  beforePhotoRetake: {
    flex: 1,
    alignItems: "center",
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  beforePhotoRetakeText: {
    fontSize: FontSize.md,
    fontWeight: "600",
    color: Colors.textSecondary,
  },
  beforePhotoUploadBtn: {
    flex: 1,
    alignItems: "center",
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.primary,
  },
  beforePhotoUploadText: {
    fontSize: FontSize.md,
    fontWeight: "700",
    color: "#fff",
  },
  beforePhotoSkip: {
    alignSelf: "center",
    marginTop: Spacing.lg,
    paddingVertical: Spacing.sm,
  },
  beforePhotoSkipText: {
    fontSize: FontSize.md,
    color: Colors.textMuted,
    fontWeight: "600",
  },

  watchBadge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
    marginBottom: Spacing.sm,
    gap: 4,
  },
  watchBadgeIcon: {
    fontSize: FontSize.xs,
  },
  watchBadgeText: {
    fontSize: FontSize.xs,
    fontWeight: "600",
  },
});
