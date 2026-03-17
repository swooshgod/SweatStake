/**
 * Podium Pro — Upgrade Screen
 * Shows the Pro subscription offer with savings calculator.
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Spacing, BorderRadius, FontSize, Shadow } from '@/constants/theme';
import {
  PRO_PRICE_MONTHLY,
  PRO_PRICE_YEARLY,
  estimateProSavings,
  FREE_SERVICE_FEE_PCT,
} from '@/lib/subscription';

const PRO_BENEFITS = [
  { icon: 'trophy',           label: 'Zero service fee',           desc: 'Keep 100% of your winnings' },
  { icon: 'star',             label: 'Pro badge',                  desc: 'Stand out on every leaderboard' },
  { icon: 'flash',            label: 'Priority matchmaking',       desc: 'Get into competitions faster' },
  { icon: 'lock-open',        label: 'Pro-only competitions',      desc: 'Higher stakes, Pro members only' },
  { icon: 'trending-up',      label: 'Advanced stats',             desc: 'Deep dive into your performance' },
  { icon: 'notifications',    label: 'Early access',               desc: 'New features before everyone else' },
];

export default function ProUpgradeScreen() {
  const router = useRouter();
  const [selectedPlan, setSelectedPlan] = useState<'monthly' | 'yearly'>('yearly');
  const [purchasing, setPurchasing] = useState(false);

  // Savings calculator
  const [monthlyWinnings, setMonthlyWinnings] = useState(200);
  const savings = estimateProSavings(monthlyWinnings * 100);
  const currentFee = monthlyWinnings * FREE_SERVICE_FEE_PCT;

  const handleSubscribe = async () => {
    setPurchasing(true);
    try {
      // TODO: Integrate RevenueCat
      // const { customerInfo } = await Purchases.purchaseProduct(productId);
      Alert.alert(
        'Coming Soon',
        'Podium Pro subscriptions will be available at launch. Join the waitlist to be first!',
        [{ text: 'OK' }]
      );
    } catch (error) {
      Alert.alert('Purchase Failed', 'Please try again.');
    } finally {
      setPurchasing(false);
    }
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      {/* Hero */}
      <LinearGradient
        colors={['#1A1200', '#0A0A0A']}
        style={styles.hero}
      >
        <View style={styles.proBadge}>
          <Text style={styles.proBadgeText}>⭐ PODIUM PRO</Text>
        </View>
        <Text style={styles.heroTitle}>Keep what you earn.</Text>
        <Text style={styles.heroSub}>
          Pay zero fees on your winnings. One flat monthly price.
        </Text>
      </LinearGradient>

      {/* Savings calculator */}
      <View style={styles.calculatorCard}>
        <Text style={styles.calcTitle}>How much could you save?</Text>
        <Text style={styles.calcSub}>Based on your monthly winnings</Text>

        <View style={styles.calcRow}>
          {[50, 100, 200, 500, 1000].map((amount) => (
            <TouchableOpacity
              key={amount}
              style={[styles.calcChip, monthlyWinnings === amount && styles.calcChipSelected]}
              onPress={() => setMonthlyWinnings(amount)}
            >
              <Text style={[styles.calcChipText, monthlyWinnings === amount && styles.calcChipTextSelected]}>
                ${amount}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.calcResult}>
          <View style={styles.calcItem}>
            <Text style={styles.calcLabel}>Current fees (10%)</Text>
            <Text style={[styles.calcValue, { color: Colors.error }]}>-${currentFee.toFixed(0)}/mo</Text>
          </View>
          <View style={styles.calcItem}>
            <Text style={styles.calcLabel}>Pro subscription</Text>
            <Text style={styles.calcValue}>-${PRO_PRICE_MONTHLY}/mo</Text>
          </View>
          <View style={[styles.calcItem, styles.calcItemTotal]}>
            <Text style={styles.calcLabelTotal}>Monthly savings</Text>
            <Text style={[
              styles.calcValueTotal,
              { color: savings.worthIt ? Colors.success : Colors.textMuted }
            ]}>
              {savings.worthIt ? `+$${savings.netSavings.toFixed(0)}` : 'Not worth it yet'}
            </Text>
          </View>
        </View>

        {savings.worthIt && (
          <View style={styles.calcCta}>
            <Ionicons name="checkmark-circle" size={16} color={Colors.success} />
            <Text style={styles.calcCtaText}>
              Pro pays for itself when you win ${(PRO_PRICE_MONTHLY / FREE_SERVICE_FEE_PCT).toFixed(0)}+/month
            </Text>
          </View>
        )}
      </View>

      {/* Plan selector */}
      <View style={styles.planSection}>
        <Text style={styles.sectionTitle}>Choose your plan</Text>
        <View style={styles.planRow}>
          {/* Monthly */}
          <TouchableOpacity
            style={[styles.planCard, selectedPlan === 'monthly' && styles.planCardSelected]}
            onPress={() => setSelectedPlan('monthly')}
            activeOpacity={0.7}
          >
            <Text style={styles.planName}>Monthly</Text>
            <Text style={[styles.planPrice, selectedPlan === 'monthly' && { color: Colors.primary }]}>
              ${PRO_PRICE_MONTHLY}
            </Text>
            <Text style={styles.planPer}>per month</Text>
          </TouchableOpacity>

          {/* Yearly — recommended */}
          <TouchableOpacity
            style={[styles.planCard, styles.planCardYearly, selectedPlan === 'yearly' && styles.planCardSelected]}
            onPress={() => setSelectedPlan('yearly')}
            activeOpacity={0.7}
          >
            <View style={styles.bestValueBadge}>
              <Text style={styles.bestValueText}>BEST VALUE</Text>
            </View>
            <Text style={styles.planName}>Yearly</Text>
            <Text style={[styles.planPrice, { color: Colors.primary }]}>
              ${(PRO_PRICE_YEARLY / 12).toFixed(2)}
            </Text>
            <Text style={styles.planPer}>per month</Text>
            <Text style={styles.planBilled}>Billed ${PRO_PRICE_YEARLY}/year</Text>
            <Text style={styles.planSave}>Save 33%</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Benefits */}
      <View style={styles.benefitsSection}>
        <Text style={styles.sectionTitle}>Everything in Pro</Text>
        {PRO_BENEFITS.map((benefit) => (
          <View key={benefit.label} style={styles.benefitRow}>
            <View style={styles.benefitIcon}>
              <Ionicons name={benefit.icon as any} size={18} color={Colors.primary} />
            </View>
            <View style={styles.benefitContent}>
              <Text style={styles.benefitLabel}>{benefit.label}</Text>
              <Text style={styles.benefitDesc}>{benefit.desc}</Text>
            </View>
            <Ionicons name="checkmark-circle" size={18} color={Colors.success} />
          </View>
        ))}
      </View>

      {/* CTA */}
      <TouchableOpacity
        style={[styles.subscribeBtn, purchasing && { opacity: 0.6 }]}
        onPress={handleSubscribe}
        disabled={purchasing}
        activeOpacity={0.85}
      >
        <LinearGradient
          colors={[Colors.primary, Colors.primaryDark ?? '#E04D15']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.subscribeBtnGradient}
        >
          <Text style={styles.subscribeBtnText}>
            {purchasing ? 'Processing...' : selectedPlan === 'yearly'
              ? `Start Pro — $${PRO_PRICE_YEARLY}/year`
              : `Start Pro — $${PRO_PRICE_MONTHLY}/month`}
          </Text>
        </LinearGradient>
      </TouchableOpacity>

      <TouchableOpacity style={styles.skipBtn} onPress={() => router.back()}>
        <Text style={styles.skipText}>Maybe later</Text>
      </TouchableOpacity>

      {/* Legal */}
      <Text style={styles.legal}>
        Subscription auto-renews. Cancel anytime in App Store settings.
        Payment charged to your Apple ID account. Terms apply.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scrollContent: { paddingBottom: 60 },
  hero: {
    padding: Spacing.xxl,
    paddingTop: 60,
    paddingBottom: Spacing.xxxl,
    alignItems: 'center',
  },
  proBadge: {
    backgroundColor: 'rgba(245, 197, 24, 0.15)',
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.sm,
    marginBottom: Spacing.xl,
    borderWidth: 1,
    borderColor: 'rgba(245, 197, 24, 0.3)',
  },
  proBadgeText: {
    fontSize: FontSize.sm,
    fontWeight: '800',
    color: '#F5C518',
    letterSpacing: 2,
  },
  heroTitle: {
    fontSize: FontSize.xxxl,
    fontWeight: '900',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: Spacing.md,
    letterSpacing: -1,
  },
  heroSub: {
    fontSize: FontSize.md,
    color: '#888',
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 280,
  },
  calculatorCard: {
    margin: Spacing.lg,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadow.md,
  },
  calcTitle: {
    fontSize: FontSize.lg,
    fontWeight: '800',
    color: Colors.textPrimary,
    marginBottom: 2,
  },
  calcSub: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    marginBottom: Spacing.xl,
  },
  calcRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginBottom: Spacing.xl,
  },
  calcChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.background,
  },
  calcChipSelected: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryGlow,
  },
  calcChipText: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    color: Colors.textMuted,
  },
  calcChipTextSelected: {
    color: Colors.primary,
  },
  calcResult: {
    gap: Spacing.sm,
  },
  calcItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: Spacing.sm,
  },
  calcItemTotal: {
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: Spacing.md,
    marginTop: Spacing.sm,
  },
  calcLabel: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },
  calcValue: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  calcLabelTotal: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  calcValueTotal: {
    fontSize: FontSize.md,
    fontWeight: '900',
  },
  calcCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginTop: Spacing.md,
    backgroundColor: '#22C55E10',
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
  },
  calcCtaText: {
    fontSize: FontSize.xs,
    color: Colors.success,
    fontWeight: '600',
    flex: 1,
  },
  planSection: {
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.xl,
  },
  sectionTitle: {
    fontSize: FontSize.lg,
    fontWeight: '800',
    color: Colors.textPrimary,
    marginBottom: Spacing.lg,
  },
  planRow: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  planCard: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.xl,
    borderWidth: 1.5,
    borderColor: Colors.border,
    alignItems: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  planCardYearly: {
    borderColor: Colors.primary + '40',
  },
  planCardSelected: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryGlow,
  },
  bestValueBadge: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.primary,
    paddingVertical: 3,
    alignItems: 'center',
  },
  bestValueText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#000',
    letterSpacing: 1,
  },
  planName: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    color: Colors.textSecondary,
    marginTop: Spacing.xl,
    marginBottom: Spacing.sm,
  },
  planPrice: {
    fontSize: FontSize.xxxl,
    fontWeight: '900',
    color: Colors.textPrimary,
  },
  planPer: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
  },
  planBilled: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    marginTop: 2,
  },
  planSave: {
    fontSize: FontSize.xs,
    fontWeight: '700',
    color: Colors.success,
    marginTop: 4,
  },
  benefitsSection: {
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.xl,
  },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  benefitIcon: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.primaryGlow,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  benefitContent: {
    flex: 1,
  },
  benefitLabel: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  benefitDesc: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    marginTop: 1,
  },
  subscribeBtn: {
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
    ...Shadow.gold,
  },
  subscribeBtnGradient: {
    paddingVertical: Spacing.lg + 2,
    alignItems: 'center',
  },
  subscribeBtnText: {
    fontSize: FontSize.lg,
    fontWeight: '900',
    color: '#000',
  },
  skipBtn: {
    alignItems: 'center',
    paddingVertical: Spacing.md,
    marginBottom: Spacing.md,
  },
  skipText: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
  },
  legal: {
    fontSize: 10,
    color: Colors.textMuted,
    textAlign: 'center',
    paddingHorizontal: Spacing.xxl,
    lineHeight: 15,
  },
});
