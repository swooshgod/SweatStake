import { Platform } from 'react-native';
import { supabase } from './supabase';

import type { ScoringCategory } from './types';

// ---------------------------------------------------------------------------
// Anti-cheat: Trusted source whitelist
// ---------------------------------------------------------------------------

const TRUSTED_SOURCES = [
  "com.apple.health",                  // Apple Watch hardware sensors (lowercase)
  "com.apple.workout",                 // Apple Workout app
  "com.nike.runclub",                   // Nike Run Club
  "com.strava.stravaride",             // Strava
  "com.peloton.members",               // Peloton
  "com.fitbit.FitbitMobile",           // Fitbit
  "com.garmin.connect.mobile",         // Garmin Connect
  "com.whoop.WHOOP",                   // WHOOP
  "com.underarmour.mapmyfitness.v2",   // MapMyFitness
  "com.adidas.runtastic",             // Runtastic/adidas
  "com.technogym.myWellness",         // Technogym
];

// Manual Health app entries use capital-H "com.apple.Health"
const REJECTED_SOURCES = [
  "com.apple.Health",
];

function isSourceTrusted(sourceId?: string): boolean {
  if (!sourceId) return false;
  if (REJECTED_SOURCES.includes(sourceId)) return false;
  return TRUSTED_SOURCES.some((s) => sourceId.startsWith(s));
}

// ---------------------------------------------------------------------------
// Anti-cheat: Anomaly detection
// ---------------------------------------------------------------------------

export interface AnomalyFlag {
  metric: string;
  value: number;
  reason: string;
  severity: "warn" | "disqualify";
}

export interface ValidationResult {
  valid: boolean;
  flags: AnomalyFlag[];
}

const ANOMALY_LIMITS = {
  maxDailySteps: 60000,
  maxDailyCalories: 5000,
  maxDailyWorkouts: 4,
  maxWorkoutDurationHours: 8,
  minWorkoutDurationMinutes: 10,
  maxStepsPerMinute: 200,
};

// Disqualification thresholds (hard ceiling — physically impossible)
const DISQUALIFY_LIMITS = {
  maxDailySteps: 100000,
  maxDailyCalories: 10000,
  maxDailyWorkouts: 8,
};

export function validateDailyData(data: HealthKitData): ValidationResult {
  const flags: AnomalyFlag[] = [];

  if (data.steps > DISQUALIFY_LIMITS.maxDailySteps) {
    flags.push({ metric: 'steps', value: data.steps, reason: `${data.steps} steps exceeds physical limit`, severity: 'disqualify' });
  } else if (data.steps > ANOMALY_LIMITS.maxDailySteps) {
    flags.push({ metric: 'steps', value: data.steps, reason: `${data.steps} steps is unusually high`, severity: 'warn' });
  }

  if (data.activeCalories > DISQUALIFY_LIMITS.maxDailyCalories) {
    flags.push({ metric: 'calories', value: data.activeCalories, reason: `${data.activeCalories} cal exceeds physical limit`, severity: 'disqualify' });
  } else if (data.activeCalories > ANOMALY_LIMITS.maxDailyCalories) {
    flags.push({ metric: 'calories', value: data.activeCalories, reason: `${data.activeCalories} cal is unusually high`, severity: 'warn' });
  }

  if (data.workouts > DISQUALIFY_LIMITS.maxDailyWorkouts) {
    flags.push({ metric: 'workouts', value: data.workouts, reason: `${data.workouts} workouts exceeds physical limit`, severity: 'disqualify' });
  } else if (data.workouts > ANOMALY_LIMITS.maxDailyWorkouts) {
    flags.push({ metric: 'workouts', value: data.workouts, reason: `${data.workouts} workouts in one day is suspicious`, severity: 'warn' });
  }

  if (data.activeMinutes > 0) {
    const stepsPerMin = data.steps / data.activeMinutes;
    if (stepsPerMin > ANOMALY_LIMITS.maxStepsPerMinute) {
      flags.push({ metric: 'stepsPerMinute', value: stepsPerMin, reason: `${Math.round(stepsPerMin)} steps/min exceeds human cadence`, severity: 'disqualify' });
    }
  }

  const hasDisqualify = flags.some((f) => f.severity === 'disqualify');

  return { valid: !hasDisqualify, flags };
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface HealthKitData {
  steps: number;
  workouts: number;
  activeCalories: number;
  activeMinutes: number;
  distanceMiles: number;
}

interface HealthKitSample {
  value: number;
  sourceId?: string;
  sourceName?: string;
  startDate?: string;
  start?: string;
  end?: string;
}

// ---------------------------------------------------------------------------
// HealthKit permissions
// ---------------------------------------------------------------------------

const PERMISSIONS = {
  permissions: {
    read: [
      'StepCount',
      'ActiveEnergyBurned',
      'Workout',
      'HeartRate',
    ],
    write: [],
  },
};

/**
 * Request HealthKit permissions using react-native-health.
 */
export async function requestHealthKitPermissions(): Promise<boolean> {
  if (Platform.OS !== 'ios') return false;

  try {
    const AppleHealthKit = require('react-native-health').default;

    return new Promise((resolve) => {
      AppleHealthKit.initHealthKit(PERMISSIONS, (error: string) => {
        if (error) {
          console.warn('HealthKit init error:', error);
          resolve(false);
          return;
        }
        resolve(true);
      });
    });
  } catch (error) {
    console.warn('HealthKit not available:', error);
    return false;
  }
}

/**
 * Check if HealthKit is available on this device.
 */
export function isHealthKitAvailable(): boolean {
  return Platform.OS === 'ios';
}

/**
 * Check if an Apple Watch is paired to this device.
 */
export async function checkAppleWatchPaired(): Promise<boolean> {
  if (Platform.OS !== 'ios') return false;

  try {
    const AppleHealthKit = require('react-native-health').default;

    const initialized = await new Promise<boolean>((resolve) => {
      AppleHealthKit.initHealthKit(PERMISSIONS, (error: string) => {
        resolve(!error);
      });
    });

    if (!initialized) return false;

    return new Promise<boolean>((resolve) => {
      AppleHealthKit.getActiveEnergyBurned(
        {
          startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
          endDate: new Date().toISOString(),
        },
        (err: string, results: Array<{ sourceId?: string; sourceName?: string }>) => {
          if (err || !results) {
            resolve(false);
            return;
          }
          const hasWatchSource = results.some(
            (r) =>
              r.sourceName?.toLowerCase().includes('watch') ||
              r.sourceId?.toLowerCase().includes('watch')
          );
          resolve(hasWatchSource);
        }
      );
    });
  } catch (error) {
    console.warn('Apple Watch check failed:', error);
    return false;
  }
}

// ---------------------------------------------------------------------------
// Source-filtered data fetching
// ---------------------------------------------------------------------------

/**
 * Check if a workout has heart rate samples (proves hardware sensor was worn).
 */
async function workoutHasHeartRate(
  AppleHealthKit: any,
  workoutStart: string,
  workoutEnd: string
): Promise<boolean> {
  return new Promise((resolve) => {
    AppleHealthKit.getHeartRateSamples(
      { startDate: workoutStart, endDate: workoutEnd },
      (err: string, results: HealthKitSample[]) => {
        if (err || !results) { resolve(false); return; }
        // Need at least 2 HR samples during the workout to count
        const trustedHR = results.filter((r) => isSourceTrusted(r.sourceId));
        resolve(trustedHR.length >= 2);
      }
    );
  });
}

/**
 * Get today's health data from HealthKit with source filtering.
 * @param requireHeartRate If true, only count workouts with HR data (default: false)
 */
export async function getTodayHealthData(requireHeartRate = false): Promise<HealthKitData> {
  if (Platform.OS !== 'ios') {
    return { steps: 0, workouts: 0, activeCalories: 0, activeMinutes: 0, distanceMiles: 0 };
  }

  try {
    const AppleHealthKit = require('react-native-health').default;
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const options = {
      startDate: startOfDay.toISOString(),
      endDate: now.toISOString(),
    };

    const [steps, calories, workoutResults] = await Promise.all([
      // Steps — use sample-level query for source filtering
      new Promise<number>((resolve) => {
        AppleHealthKit.getDailyStepCountSamples(
          options,
          (err: string, results: HealthKitSample[]) => {
            if (err || !results) { resolve(0); return; }
            const trusted = results.filter((r) => isSourceTrusted(r.sourceId));
            const rejected = results.filter((r) => !isSourceTrusted(r.sourceId));
            if (rejected.length > 0) {
              console.warn('[AntiCheat] Rejected step sources:', rejected.map((r) => r.sourceId));
            }
            resolve(trusted.reduce((sum, r) => sum + (r.value ?? 0), 0));
          }
        );
      }),
      // Calories — filter by source
      new Promise<number>((resolve) => {
        AppleHealthKit.getActiveEnergyBurned(
          options,
          (err: string, results: HealthKitSample[]) => {
            if (err || !results) { resolve(0); return; }
            const trusted = results.filter((r) => isSourceTrusted(r.sourceId));
            const rejected = results.filter((r) => !isSourceTrusted(r.sourceId));
            if (rejected.length > 0) {
              console.warn('[AntiCheat] Rejected calorie sources:', rejected.map((r) => r.sourceId));
            }
            resolve(trusted.reduce((sum, r) => sum + (r.value ?? 0), 0));
          }
        );
      }),
      // Workouts — filter by source + optional HR check
      (async () => {
        const rawWorkouts = await new Promise<HealthKitSample[]>((resolve) => {
          AppleHealthKit.getSamples(
            { ...options, type: 'Workout' },
            (err: string, results: HealthKitSample[]) => {
              if (err || !results) { resolve([]); return; }
              resolve(results);
            }
          );
        });

        const trusted = rawWorkouts.filter((r) => isSourceTrusted(r.sourceId));
        const rejected = rawWorkouts.filter((r) => !isSourceTrusted(r.sourceId));
        if (rejected.length > 0) {
          console.warn('[AntiCheat] Rejected workout sources:', rejected.map((r) => r.sourceId));
        }

        // Filter out workouts shorter than minimum duration
        const validDuration = trusted.filter((r) => {
          if (!r.start || !r.end) return false;
          const mins = (new Date(r.end).getTime() - new Date(r.start).getTime()) / 60000;
          return mins >= ANOMALY_LIMITS.minWorkoutDurationMinutes;
        });

        // Optionally require heart rate proof
        let verified = validDuration;
        if (requireHeartRate) {
          const hrChecks = await Promise.all(
            validDuration.map(async (w) => {
              const hasHR = await workoutHasHeartRate(AppleHealthKit, w.start!, w.end!);
              if (!hasHR) console.warn('[AntiCheat] Workout missing HR data:', w.start);
              return hasHR;
            })
          );
          verified = validDuration.filter((_, i) => hrChecks[i]);
        }

        const totalMinutes = verified.reduce((sum, r) => {
          return sum + (new Date(r.end!).getTime() - new Date(r.start!).getTime()) / 60000;
        }, 0);

        // Cap individual workout duration
        const cappedMinutes = Math.min(totalMinutes, ANOMALY_LIMITS.maxWorkoutDurationHours * 60);

        return { count: verified.length, totalMinutes: cappedMinutes };
      })(),
    ]);

    // Also fetch distance (walking + running)
    const distanceMeters = await new Promise<number>((resolve) => {
      AppleHealthKit.getDistanceWalkingRunning(
        options,
        (err: string, results: HealthKitSample[]) => {
          if (err || !results) { resolve(0); return; }
          const trusted = results.filter((r) => isSourceTrusted(r.sourceId));
          resolve(trusted.reduce((sum, r) => sum + (r.value ?? 0), 0));
        }
      );
    });

    return {
      steps: Math.round(steps),
      workouts: workoutResults.count,
      activeCalories: Math.round(calories),
      activeMinutes: Math.round(workoutResults.totalMinutes),
      distanceMiles: Math.round((distanceMeters / 1609.34) * 100) / 100,
    };
  } catch (error) {
    console.warn('Failed to fetch HealthKit data:', error);
    return { steps: 0, workouts: 0, activeCalories: 0, activeMinutes: 0, distanceMiles: 0 };
  }
}

// ---------------------------------------------------------------------------
// Device registration
// ---------------------------------------------------------------------------

interface DeviceInfo {
  deviceName: string;
  sourceBundleId: string;
}

async function getDeviceInfo(): Promise<DeviceInfo | null> {
  if (Platform.OS !== 'ios') return null;

  try {
    const AppleHealthKit = require('react-native-health').default;

    return new Promise((resolve) => {
      AppleHealthKit.getActiveEnergyBurned(
        {
          startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
          endDate: new Date().toISOString(),
        },
        (err: string, results: Array<{ sourceId?: string; sourceName?: string }>) => {
          if (err || !results || results.length === 0) {
            resolve(null);
            return;
          }
          // Pick the most common trusted source as the "primary device"
          const trusted = results.filter((r) => isSourceTrusted(r.sourceId));
          if (trusted.length === 0) { resolve(null); return; }

          const counts: Record<string, { count: number; name: string }> = {};
          trusted.forEach((r) => {
            const id = r.sourceId ?? 'unknown';
            if (!counts[id]) counts[id] = { count: 0, name: r.sourceName ?? 'Unknown' };
            counts[id].count++;
          });

          const primary = Object.entries(counts).sort((a, b) => b[1].count - a[1].count)[0];
          resolve({ deviceName: primary[1].name, sourceBundleId: primary[0] });
        }
      );
    });
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Weight Loss % competition helpers
// ---------------------------------------------------------------------------

export interface WeighIn {
  weightLbs: number;
  loggedAt: string;
  isStartingWeight: boolean;
}

/**
 * Calculate weight loss percentage between starting and current weight.
 * Uses % of body weight so it's fair across all body sizes.
 */
export function calculateWeightLossPct(startingWeightLbs: number, currentWeightLbs: number): number {
  if (startingWeightLbs <= 0) return 0;
  const lost = startingWeightLbs - currentWeightLbs;
  return Math.round((lost / startingWeightLbs) * 100 * 10) / 10;
}

// Max realistic weekly weight loss = 2% of body weight
// Anything above 3% in 7 days is physically impossible / suspicious
const MAX_WEEKLY_LOSS_PCT = 3.0;

export interface WeighInResult {
  success: boolean;
  error?: string;
  flagged?: boolean;
  flagReason?: string;
}

/**
 * Validate a weigh-in for anomalies.
 * Returns flagged=true if the loss is physically suspicious.
 */
export function validateWeighIn(
  previousWeightLbs: number,
  newWeightLbs: number,
  daysSinceLast: number
): { valid: boolean; flagged: boolean; reason?: string } {
  if (newWeightLbs <= 0) return { valid: false, flagged: false, reason: 'Invalid weight.' };
  if (newWeightLbs > previousWeightLbs) return { valid: true, flagged: false }; // gained weight, fine

  const lostLbs = previousWeightLbs - newWeightLbs;
  const lostPct = (lostLbs / previousWeightLbs) * 100;
  if (daysSinceLast <= 0) return { valid: true, flagged: false };
  const weeklyEquivalent = (lostPct / daysSinceLast) * 7;

  if (weeklyEquivalent > MAX_WEEKLY_LOSS_PCT) {
    return {
      valid: true, // don't hard block, but flag for review
      flagged: true,
      reason: `${lostPct.toFixed(1)}% lost in ${daysSinceLast} day(s) exceeds the physically possible rate of ${MAX_WEEKLY_LOSS_PCT}% per week.`,
    };
  }

  return { valid: true, flagged: false };
}

/**
 * Log a verified weigh-in to Supabase.
 * Requires a photo proof URL (from storage upload).
 * Runs anomaly detection and flags suspicious entries.
 */
export async function logWeighIn(
  participantId: string,
  weightLbs: number,
  isStartingWeight: boolean,
  photoProofUrl: string,
  previousWeightLbs?: number,
  daysSinceLast?: number
): Promise<WeighInResult> {
  // Anomaly check (skip for starting weight)
  let flagged = false;
  let flagReason: string | undefined;

  if (!isStartingWeight && previousWeightLbs && daysSinceLast) {
    const check = validateWeighIn(previousWeightLbs, weightLbs, daysSinceLast);
    if (!check.valid) return { success: false, error: check.reason };
    if (check.flagged) {
      flagged = true;
      flagReason = check.reason;
    }
  }

  const { error } = await supabase.from('weigh_ins').insert({
    participant_id: participantId,
    weight_lbs: weightLbs,
    is_starting_weight: isStartingWeight,
    photo_proof_url: photoProofUrl,
    flagged,
    flag_reason: flagReason ?? null,
    logged_at: new Date().toISOString(),
  });

  if (error) {
    console.warn('[WeighIn] Failed to log:', error.message);
    return { success: false, error: 'Failed to save weigh-in. Please try again.' };
  }

  return { success: true, flagged, flagReason };
}

/**
 * Register the user's device for a competition.
 * Stores a fingerprint in Supabase so future syncs can be verified.
 */
export async function registerDevice(competitionId: string, userId: string): Promise<string | null> {
  const device = await getDeviceInfo();
  if (!device) {
    console.warn('[AntiCheat] Could not detect device info for registration');
    return null;
  }

  const { data, error } = await supabase
    .from('device_registrations')
    .upsert(
      {
        competition_id: competitionId,
        user_id: userId,
        device_name: device.deviceName,
        source_bundle_id: device.sourceBundleId,
      },
      { onConflict: 'competition_id,user_id' }
    )
    .select('id')
    .single();

  if (error) {
    console.warn('[AntiCheat] Device registration failed:', error.message);
    return null;
  }

  return data.id;
}

/**
 * Verify that incoming data matches the registered device for a competition.
 * Returns true if verified or if no registration exists (graceful fallback).
 */
export async function verifyDeviceSource(
  competitionId: string,
  userId: string,
  currentSourceId: string
): Promise<{ verified: boolean; mismatch: boolean }> {
  const { data, error } = await supabase
    .from('device_registrations')
    .select('source_bundle_id')
    .eq('competition_id', competitionId)
    .eq('user_id', userId)
    .single();

  if (error || !data) {
    // No registration found — allow but flag
    return { verified: true, mismatch: false };
  }

  const match = currentSourceId.startsWith(data.source_bundle_id);
  if (!match) {
    console.warn(
      `[AntiCheat] Device mismatch: registered=${data.source_bundle_id}, current=${currentSourceId}`
    );
  }

  return { verified: match, mismatch: !match };
}

// ---------------------------------------------------------------------------
// Evaluation helpers (unchanged)
// ---------------------------------------------------------------------------

/**
 * Determine which checklist items are completed based on HealthKit data.
 */
export function evaluateHealthData(data: HealthKitData) {
  return {
    workout: data.workouts > 0,
    steps: data.steps,
    stepsGoalMet: data.steps >= 8000,
    activeCalories: data.activeCalories,
    activeMinutes: data.activeMinutes,
  };
}

/**
 * Calculate weekly penalty for missed workout threshold.
 * Returns 0 or a negative number (capped at -maxPenalty).
 */
export function calculateWeeklyPenalty(workoutsThisWeek: number, category: ScoringCategory): number {
  if (!category.penalty) return 0;
  const { threshold, penaltyPerMissed, maxPenalty } = category.penalty;
  if (workoutsThisWeek >= threshold) return 0;
  return -Math.min((threshold - workoutsThisWeek) * penaltyPerMissed, maxPenalty);
}

export interface UserBaseline {
  avgDailySteps: number;
  avgDailyCalories: number;
  avgDailyWorkoutMinutes: number;
  calculatedAt: string;
}

/**
 * Reads last 7 days of HealthKit data and returns average daily metrics.
 * Returns null if less than 3 days of data available.
 */
export async function getUserBaseline(): Promise<UserBaseline | null> {
  if (Platform.OS !== 'ios') return null;

  try {
    const AppleHealthKit = require('react-native-health').default;
    const now = new Date();
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const options = {
      startDate: sevenDaysAgo.toISOString(),
      endDate: now.toISOString(),
    };

    const [dailySteps, calories, workouts] = await Promise.all([
      new Promise<number[]>((resolve) => {
        AppleHealthKit.getDailyStepCountSamples(
          { ...options, period: 1 },
          (err: string, results: HealthKitSample[]) => {
            if (err || !results) { resolve([]); return; }
            const trusted = results.filter((r) => isSourceTrusted(r.sourceId));
            resolve(trusted.map((r) => r.value));
          }
        );
      }),
      new Promise<number[]>((resolve) => {
        AppleHealthKit.getActiveEnergyBurned(options, (err: string, results: HealthKitSample[]) => {
          if (err || !results) { resolve([]); return; }
          const trusted = results.filter((r) => isSourceTrusted(r.sourceId));
          const byDay: Record<string, number> = {};
          trusted.forEach((r) => {
            const day = (r.startDate ?? '').split('T')[0];
            if (day) byDay[day] = (byDay[day] ?? 0) + r.value;
          });
          resolve(Object.values(byDay));
        });
      }),
      new Promise<number[]>((resolve) => {
        AppleHealthKit.getSamples(
          { ...options, type: 'Workout' },
          (err: string, results: HealthKitSample[]) => {
            if (err || !results) { resolve([]); return; }
            const trusted = results.filter((r) => isSourceTrusted(r.sourceId));
            const byDay: Record<string, number> = {};
            trusted.forEach((r) => {
              if (!r.start || !r.end) return;
              const day = r.start.split('T')[0];
              const mins = (new Date(r.end).getTime() - new Date(r.start).getTime()) / 60000;
              byDay[day] = (byDay[day] ?? 0) + mins;
            });
            resolve(Object.values(byDay));
          }
        );
      }),
    ]);

    if (dailySteps.length < 3) return null;

    const avg = (arr: number[]) => arr.length === 0 ? 0 : arr.reduce((a, b) => a + b, 0) / arr.length;

    return {
      avgDailySteps: Math.round(avg(dailySteps)),
      avgDailyCalories: Math.round(avg(calories)),
      avgDailyWorkoutMinutes: Math.round(avg(workouts)),
      calculatedAt: now.toISOString(),
    };
  } catch (error) {
    console.warn('Failed to calculate baseline:', error);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Fitness tier system
// ---------------------------------------------------------------------------

export type FitnessTier = 'beginner' | 'active' | 'athlete' | 'elite';

export interface TierInfo {
  tier: FitnessTier;
  label: string;
  emoji: string;
  color: string;
  minSteps: number;
  maxSteps: number;
  description: string;
}

export const FITNESS_TIERS: Record<FitnessTier, TierInfo> = {
  beginner: {
    tier: 'beginner',
    label: 'Beginner',
    emoji: '🟢',
    color: '#22C55E',
    minSteps: 0,
    maxSteps: 2999,
    description: 'Building a fitness habit',
  },
  active: {
    tier: 'active',
    label: 'Active',
    emoji: '🔵',
    color: '#3B82F6',
    minSteps: 3000,
    maxSteps: 6999,
    description: 'Regularly moving',
  },
  athlete: {
    tier: 'athlete',
    label: 'Athlete',
    emoji: '🟡',
    color: '#F5C518',
    minSteps: 7000,
    maxSteps: 11999,
    description: 'Seriously active',
  },
  elite: {
    tier: 'elite',
    label: 'Elite',
    emoji: '🔴',
    color: '#EF4444',
    minSteps: 12000,
    maxSteps: Infinity,
    description: 'Peak performance',
  },
};

// ---------------------------------------------------------------------------
// Composite fitness score calculation
// ---------------------------------------------------------------------------

export interface CompositeFitnessScore {
  score: number;           // 0–100
  tier: FitnessTier;
  breakdown: {
    stepsScore: number;    // 0–40 points
    activeMinScore: number;// 0–35 points
    workoutScore: number;  // 0–25 points
  };
  avgDailySteps: number;
  avgActiveMinutes: number;
  avgWorkoutDaysPerWeek: number;
}

/**
 * Calculate a composite fitness score (0–100) from a user's baseline.
 * Weighted: Steps 40% + Active Minutes 35% + Workout Frequency 25%
 *
 * This prevents gaming via step-only metrics and accommodates
 * cyclists, weightlifters, yogis, and runners equally.
 */
export function calculateCompositeFitnessScore(baseline: UserBaseline): CompositeFitnessScore {
  // Steps score (0–40): max at 15,000+ steps/day
  const stepsScore = Math.min(40, Math.round((baseline.avgDailySteps / 15000) * 40));

  // Active minutes score (0–35): max at 60+ min/day
  const activeMinScore = Math.min(35, Math.round((baseline.avgDailyWorkoutMinutes / 60) * 35));

  // Workout frequency score (0–25): inferred from workout minutes
  // 5+ days/week of 30+ min workouts = max score
  const estimatedDaysPerWeek = Math.min(7, baseline.avgDailyWorkoutMinutes >= 30 ? 5 : Math.floor(baseline.avgDailyWorkoutMinutes / 15));
  const workoutScore = Math.min(25, Math.round((estimatedDaysPerWeek / 5) * 25));

  const score = stepsScore + activeMinScore + workoutScore;

  // Tier thresholds based on composite score
  let tier: FitnessTier;
  if (score >= 70) tier = 'elite';
  else if (score >= 45) tier = 'athlete';
  else if (score >= 22) tier = 'active';
  else tier = 'beginner';

  return {
    score,
    tier,
    breakdown: { stepsScore, activeMinScore, workoutScore },
    avgDailySteps: baseline.avgDailySteps,
    avgActiveMinutes: baseline.avgDailyWorkoutMinutes,
    avgWorkoutDaysPerWeek: estimatedDaysPerWeek,
  };
}

/**
 * Get fitness tier from a composite score (legacy: steps-only fallback).
 * Prefer calculateCompositeFitnessScore() when full baseline is available.
 */

const TIER_ORDER: FitnessTier[] = ['beginner', 'active', 'athlete', 'elite'];

/**
 * Calculate fitness tier from average daily steps.
 */
export function getTierFromSteps(avgDailySteps: number): FitnessTier {
  if (avgDailySteps >= 12000) return 'elite';
  if (avgDailySteps >= 7000) return 'athlete';
  if (avgDailySteps >= 3000) return 'active';
  return 'beginner';
}

/**
 * Get tier index (0=beginner, 3=elite).
 */
export function getTierIndex(tier: FitnessTier): number {
  return TIER_ORDER.indexOf(tier);
}

/**
 * Check if a joiner's tier is compatible with a competition's tier lock.
 * Returns { allowed, warning } — warning is shown even when allowed.
 */
export function checkTierCompatibility(
  joinerTier: FitnessTier,
  creatorTier: FitnessTier,
  tierLock: TierLockMode
): { allowed: boolean; warning: string | null } {
  const joinerIdx = getTierIndex(joinerTier);
  const creatorIdx = getTierIndex(creatorTier);
  const diff = joinerIdx - creatorIdx;

  if (tierLock === 'none') {
    // No lock — just warn if there's a big gap
    if (diff >= 2) {
      return {
        allowed: true,
        warning: `You're ${FITNESS_TIERS[joinerTier].emoji} ${FITNESS_TIERS[joinerTier].label} joining a ${FITNESS_TIERS[creatorTier].emoji} ${FITNESS_TIERS[creatorTier].label} lobby. You may have a significant advantage.`,
      };
    }
    if (diff <= -2) {
      return {
        allowed: true,
        warning: `⚠️ This lobby is above your fitness level. You're ${FITNESS_TIERS[joinerTier].emoji} ${FITNESS_TIERS[joinerTier].label} — the creator is ${FITNESS_TIERS[creatorTier].emoji} ${FITNESS_TIERS[creatorTier].label}. You may be outmatched.`,
      };
    }
    return { allowed: true, warning: null };
  }

  if (tierLock === 'same') {
    if (joinerTier !== creatorTier) {
      return {
        allowed: false,
        warning: `This competition is locked to ${FITNESS_TIERS[creatorTier].emoji} ${FITNESS_TIERS[creatorTier].label} only. Your tier is ${FITNESS_TIERS[joinerTier].emoji} ${FITNESS_TIERS[joinerTier].label}.`,
      };
    }
    return { allowed: true, warning: null };
  }

  if (tierLock === 'within_one') {
    if (Math.abs(diff) > 1) {
      return {
        allowed: false,
        warning: `This competition allows tiers within one level of ${FITNESS_TIERS[creatorTier].emoji} ${FITNESS_TIERS[creatorTier].label}. Your tier is ${FITNESS_TIERS[joinerTier].emoji} ${FITNESS_TIERS[joinerTier].label}.`,
      };
    }
    return { allowed: true, warning: null };
  }

  return { allowed: true, warning: null };
}

export type TierLockMode = 'none' | 'within_one' | 'same';

export const TIER_LOCK_OPTIONS: Array<{ id: TierLockMode; label: string; description: string }> = [
  { id: 'none', label: 'Open to all', description: 'Anyone can join regardless of fitness level' },
  { id: 'within_one', label: 'Similar levels only', description: 'Only competitors within one tier of you (e.g. Active can join with Beginner or Athlete)' },
  { id: 'same', label: 'Same tier only', description: 'Only competitors at exactly your fitness level' },
];

// ---------------------------------------------------------------------------
// Baseline readiness check
// ---------------------------------------------------------------------------

export interface BaselineReadiness {
  ready: boolean;
  daysOfData: number;
  message?: string;
  canJoinImprovementCompetition: boolean;
}

/**
 * Check if the user has enough Apple Health history to participate
 * in a % Improvement competition fairly.
 *
 * Requires at least 3 days of step data in the last 7 days.
 * Shows a friendly warning if not enough data exists yet.
 */
export async function checkBaselineReadiness(): Promise<BaselineReadiness> {
  if (Platform.OS !== 'ios') {
    return {
      ready: false,
      daysOfData: 0,
      canJoinImprovementCompetition: false,
      message: 'Apple Health is only available on iPhone.',
    };
  }

  try {
    const AppleHealthKit = require('react-native-health').default;
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const dailySteps = await new Promise<number[]>((resolve) => {
      AppleHealthKit.getDailyStepCountSamples(
        { startDate: sevenDaysAgo.toISOString(), endDate: new Date().toISOString(), period: 1 },
        (err: string, results: Array<{ value: number; startDate?: string; sourceId?: string }>) => {
          if (err || !results) { resolve([]); return; }
          // Only count days with trusted sources
          const trusted = results.filter((r) => isSourceTrusted(r.sourceId));
          // Group by day
          const byDay: Record<string, number> = {};
          trusted.forEach((r) => {
            const day = (r.startDate ?? '').split('T')[0];
            if (day) byDay[day] = (byDay[day] ?? 0) + r.value;
          });
          // Only count days with meaningful activity (>500 steps)
          const activeDays = Object.values(byDay).filter((v) => v > 500);
          resolve(activeDays);
        }
      );
    });

    const daysOfData = dailySteps.length;
    const ready = daysOfData >= 3;

    if (!ready) {
      const daysNeeded = 3 - daysOfData;
      return {
        ready: false,
        daysOfData,
        canJoinImprovementCompetition: false,
        message: daysOfData === 0
          ? `Your iPhone needs at least 3 days of step data to join a % Improvement competition fairly. Make sure Apple Health is tracking your steps and try again in a few days.`
          : `You have ${daysOfData} day${daysOfData === 1 ? '' : 's'} of activity data. We need at least 3 days to calculate your personal baseline fairly. Check back in ${daysNeeded} day${daysNeeded === 1 ? '' : 's'}!`,
      };
    }

    return {
      ready: true,
      daysOfData,
      canJoinImprovementCompetition: true,
    };
  } catch (error) {
    console.warn('[Baseline] Check failed:', error);
    // Fail open — don't block users if HealthKit is unavailable
    return {
      ready: true,
      daysOfData: 0,
      canJoinImprovementCompetition: true,
      message: 'Could not verify activity history — proceeding anyway.',
    };
  }
}

/**
 * Calculate percentage improvement above baseline.
 */
export function calculateImprovementScore(
  baseline: UserBaseline,
  current: { steps: number; calories: number; workoutMinutes: number }
): number {
  let totalImprovement = 0;
  let metrics = 0;

  if (baseline.avgDailySteps > 0) {
    totalImprovement += ((current.steps - baseline.avgDailySteps) / baseline.avgDailySteps) * 100;
    metrics++;
  }
  if (baseline.avgDailyCalories > 0) {
    totalImprovement += ((current.calories - baseline.avgDailyCalories) / baseline.avgDailyCalories) * 100;
    metrics++;
  }
  if (baseline.avgDailyWorkoutMinutes > 0) {
    totalImprovement += ((current.workoutMinutes - baseline.avgDailyWorkoutMinutes) / baseline.avgDailyWorkoutMinutes) * 100;
    metrics++;
  }

  if (metrics === 0) return 0;
  return Math.round((totalImprovement / metrics) * 10) / 10;
}
