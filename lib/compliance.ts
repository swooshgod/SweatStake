/**
 * Podium — Compliance Module
 * Geo-blocking, skill-game classification, and age verification
 * for paid competitions.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ComplianceResult {
  allowed: boolean;
  reason?: string;
  requiresAgeVerification?: boolean;
}

interface CompetitionLike {
  id: string;
  entry_fee_cents: number;
  scoring_mode: string;
  scoring_template?: { categories?: Array<{ name: string; points: number }> };
  is_public: boolean;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const MIN_AGE = 18;
const AGE_VERIFIED_KEY = 'podium_age_verified';
const LOCATION_CACHE_KEY = 'podium_location_cache';
const LOCATION_CACHE_TTL_MS = 1000 * 60 * 60 * 24; // 24 hours

/**
 * US states where skill-based prize competitions are restricted.
 * This list should be reviewed periodically with legal counsel.
 */
const RESTRICTED_US_STATES = new Set([
  'AZ', // Arizona
  'AR', // Arkansas
  'CT', // Connecticut
  'DE', // Delaware
  'LA', // Louisiana
  'MD', // Maryland
  'MT', // Montana
  'SC', // South Carolina
  'SD', // South Dakota
  'TN', // Tennessee
]);

/**
 * Countries where online prize competitions are broadly restricted.
 */
const RESTRICTED_COUNTRIES = new Set([
  'CN', // China
  'KP', // North Korea
  'CU', // Cuba
  'IR', // Iran
  'SY', // Syria
  'AF', // Afghanistan
  'MM', // Myanmar
  'SD', // Sudan
]);

// ---------------------------------------------------------------------------
// Legal classification
// ---------------------------------------------------------------------------

export const SKILL_GAME_LEGAL_COPY = `
Podium competitions are skill-based contests, not games of chance.
Outcomes are determined solely by participants' athletic effort and 
performance improvement as measured by Apple Health sensors. 
Winners are determined by objective, verifiable fitness metrics — 
not random chance. This classifies Podium as a skill-based competition
under applicable state and federal law.
`.trim();

/**
 * Returns true if the competition qualifies as skill-based under the law.
 * Skill-based = outcome determined by participant effort, not chance.
 */
export function isSkillBasedCompetition(competition: CompetitionLike): boolean {
  // % improvement scoring is always skill-based (effort-determined)
  if (competition.scoring_mode === 'relative_improvement') return true;

  // Multi-category scoring (Full Challenge) is skill-based
  const categories = competition.scoring_template?.categories ?? [];
  if (categories.length >= 3) return true;

  // Single-metric raw competitions are still skill-based (you control your steps)
  const skillModes = ['raw_steps', 'raw_miles', 'raw_calories', 'raw_workouts'];
  if (skillModes.includes(competition.scoring_mode)) return true;

  return false;
}

// ---------------------------------------------------------------------------
// Age verification
// ---------------------------------------------------------------------------

/**
 * Check if a birthdate meets the minimum age requirement.
 */
export function verifyAge(birthdate: Date): boolean {
  const today = new Date();
  const age = today.getFullYear() - birthdate.getFullYear();
  const monthDiff = today.getMonth() - birthdate.getMonth();
  const dayDiff = today.getDate() - birthdate.getDate();

  if (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) {
    return age - 1 >= MIN_AGE;
  }
  return age >= MIN_AGE;
}

/**
 * Check if the user has already completed age verification.
 */
export async function isAgeVerified(): Promise<boolean> {
  try {
    const stored = await AsyncStorage.getItem(AGE_VERIFIED_KEY);
    if (!stored) return false;
    const { verified, birthdate } = JSON.parse(stored);
    if (!verified || !birthdate) return false;
    // Re-verify stored birthdate (sanity check)
    return verifyAge(new Date(birthdate));
  } catch {
    return false;
  }
}

/**
 * Save age verification result to AsyncStorage.
 */
export async function saveAgeVerification(birthdate: Date): Promise<void> {
  await AsyncStorage.setItem(
    AGE_VERIFIED_KEY,
    JSON.stringify({ verified: true, birthdate: birthdate.toISOString(), verifiedAt: new Date().toISOString() })
  );
}

// ---------------------------------------------------------------------------
// Geo-blocking
// ---------------------------------------------------------------------------

interface LocationCache {
  countryCode: string;
  regionCode: string | null;
  cachedAt: number;
}

async function getCachedLocation(): Promise<LocationCache | null> {
  try {
    const cached = await AsyncStorage.getItem(LOCATION_CACHE_KEY);
    if (!cached) return null;
    const data: LocationCache = JSON.parse(cached);
    if (Date.now() - data.cachedAt > LOCATION_CACHE_TTL_MS) return null;
    return data;
  } catch {
    return null;
  }
}

async function getUserLocation(): Promise<{ countryCode: string; regionCode: string | null } | null> {
  // Check cache first
  const cached = await getCachedLocation();
  if (cached) return cached;

  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return null;

    const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low });
    const [geocode] = await Location.reverseGeocodeAsync({
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
    });

    if (!geocode) return null;

    const result = {
      countryCode: geocode.isoCountryCode ?? '',
      regionCode: geocode.region ?? null,
    };

    // Cache the result
    await AsyncStorage.setItem(
      LOCATION_CACHE_KEY,
      JSON.stringify({ ...result, cachedAt: Date.now() })
    );

    return result;
  } catch {
    return null;
  }
}

/**
 * Check if the user's location allows paid competitions.
 */
export async function checkLocationCompliance(): Promise<{ allowed: boolean; reason?: string }> {
  const location = await getUserLocation();

  // If we can't determine location, allow but log
  if (!location || !location.countryCode) {
    console.warn('[Compliance] Could not determine user location — allowing by default');
    return { allowed: true };
  }

  // Check restricted countries
  if (RESTRICTED_COUNTRIES.has(location.countryCode)) {
    return {
      allowed: false,
      reason: 'Paid competitions are not available in your country.',
    };
  }

  // Check restricted US states
  if (location.countryCode === 'US' && location.regionCode) {
    // Extract 2-letter state code from region string
    const stateMatch = location.regionCode.match(/\b([A-Z]{2})\b/);
    const stateCode = stateMatch ? stateMatch[1] : location.regionCode.toUpperCase().slice(0, 2);

    if (RESTRICTED_US_STATES.has(stateCode)) {
      return {
        allowed: false,
        reason: `Paid competitions are not currently available in ${location.regionCode}. Free competitions are still available.`,
      };
    }
  }

  return { allowed: true };
}

// ---------------------------------------------------------------------------
// Main compliance check
// ---------------------------------------------------------------------------

/**
 * Run all compliance checks for a user joining a paid competition.
 *
 * @returns ComplianceResult — allowed, reason if blocked, requiresAgeVerification if needed
 */
export async function checkComplianceForPaidCompetition(
  _userId: string,
  competition: CompetitionLike
): Promise<ComplianceResult> {
  // Free competitions skip all checks
  if (competition.entry_fee_cents === 0) {
    return { allowed: true };
  }

  // 1. Skill-game check
  if (!isSkillBasedCompetition(competition)) {
    return {
      allowed: false,
      reason: 'This competition does not meet skill-game requirements for paid entry.',
    };
  }

  // 2. Geo-blocking
  const locationCheck = await checkLocationCompliance();
  if (!locationCheck.allowed) {
    return { allowed: false, reason: locationCheck.reason };
  }

  // 3. Age verification
  const ageVerified = await isAgeVerified();
  if (!ageVerified) {
    return {
      allowed: false,
      reason: 'Age verification required.',
      requiresAgeVerification: true,
    };
  }

  return { allowed: true };
}
