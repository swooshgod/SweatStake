import { Platform } from 'react-native';

interface HealthKitData {
  steps: number;
  workouts: number;
  activeCalories: number;
  waterOz: number;
}

// HealthKit permissions for react-native-health
const PERMISSIONS = {
  permissions: {
    read: [
      'StepCount',
      'ActiveEnergyBurned',
      'DietaryWater',
      'Workout',
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
 * Returns false gracefully on Android, simulator, or if HealthKit is unavailable.
 */
export async function checkAppleWatchPaired(): Promise<boolean> {
  if (Platform.OS !== 'ios') return false;

  try {
    const AppleHealthKit = require('react-native-health').default;

    // First ensure HealthKit is initialized
    const initialized = await new Promise<boolean>((resolve) => {
      AppleHealthKit.initHealthKit(PERMISSIONS, (error: string) => {
        resolve(!error);
      });
    });

    if (!initialized) return false;

    // Check for workout data source availability as a proxy for Watch pairing.
    // If ActiveEnergyBurned samples exist from a Watch source, it's paired.
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
          // Look for Watch-sourced data (source name typically contains "Watch")
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

/**
 * Get today's health data from HealthKit.
 */
export async function getTodayHealthData(): Promise<HealthKitData> {
  if (Platform.OS !== 'ios') {
    return { steps: 0, workouts: 0, activeCalories: 0, waterOz: 0 };
  }

  try {
    const AppleHealthKit = require('react-native-health').default;
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const options = {
      startDate: startOfDay.toISOString(),
      endDate: now.toISOString(),
    };

    const [steps, calories, water, workouts] = await Promise.all([
      new Promise<number>((resolve) => {
        AppleHealthKit.getStepCount(options, (err: string, results: { value: number }) => {
          resolve(err ? 0 : results?.value ?? 0);
        });
      }),
      new Promise<number>((resolve) => {
        AppleHealthKit.getActiveEnergyBurned(options, (err: string, results: Array<{ value: number }>) => {
          if (err || !results) { resolve(0); return; }
          resolve(results.reduce((sum, r) => sum + r.value, 0));
        });
      }),
      new Promise<number>((resolve) => {
        AppleHealthKit.getWaterSamples(options, (err: string, results: Array<{ value: number }>) => {
          if (err || !results) { resolve(0); return; }
          // Convert from mL to oz
          resolve(results.reduce((sum, r) => sum + r.value * 0.033814, 0));
        });
      }),
      new Promise<number>((resolve) => {
        AppleHealthKit.getSamples(
          { ...options, type: 'Workout' },
          (err: string, results: unknown[]) => {
            resolve(err ? 0 : results?.length ?? 0);
          }
        );
      }),
    ]);

    return {
      steps: Math.round(steps),
      workouts,
      activeCalories: Math.round(calories),
      waterOz: Math.round(water),
    };
  } catch (error) {
    console.warn('Failed to fetch HealthKit data:', error);
    return { steps: 0, workouts: 0, activeCalories: 0, waterOz: 0 };
  }
}

/**
 * Determine which checklist items are completed based on HealthKit data.
 */
export function evaluateHealthData(data: HealthKitData) {
  return {
    workout: data.workouts > 0,
    steps: data.steps,
    stepsGoalMet: data.steps >= 8000,
    activeCalories: data.activeCalories,
    waterOz: data.waterOz,
  };
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
      // Get daily step counts
      new Promise<number[]>((resolve) => {
        AppleHealthKit.getDailyStepCountSamples(
          { ...options, period: 1 },
          (err: string, results: Array<{ value: number }>) => {
            if (err || !results) { resolve([]); return; }
            resolve(results.map((r) => r.value));
          }
        );
      }),
      // Get daily calories
      new Promise<number[]>((resolve) => {
        AppleHealthKit.getActiveEnergyBurned(options, (err: string, results: Array<{ value: number; startDate: string }>) => {
          if (err || !results) { resolve([]); return; }
          // Group by day and sum
          const byDay: Record<string, number> = {};
          results.forEach((r) => {
            const day = r.startDate.split('T')[0];
            byDay[day] = (byDay[day] ?? 0) + r.value;
          });
          resolve(Object.values(byDay));
        });
      }),
      // Get workout minutes
      new Promise<number[]>((resolve) => {
        AppleHealthKit.getSamples(
          { ...options, type: 'Workout' },
          (err: string, results: Array<{ start: string; end: string }>) => {
            if (err || !results) { resolve([]); return; }
            // Group by day, sum minutes
            const byDay: Record<string, number> = {};
            results.forEach((r) => {
              const day = r.start.split('T')[0];
              const mins = (new Date(r.end).getTime() - new Date(r.start).getTime()) / 60000;
              byDay[day] = (byDay[day] ?? 0) + mins;
            });
            resolve(Object.values(byDay));
          }
        );
      }),
    ]);

    // Require at least 3 days of step data
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

/**
 * Calculate percentage improvement above baseline.
 * Returns 0 if baseline values are zero to avoid division errors.
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
