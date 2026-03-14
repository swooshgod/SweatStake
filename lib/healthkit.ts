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
