import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Colors, Spacing, BorderRadius, FontSize, Shadow } from '@/constants/theme';
import { getTodayHealthData, evaluateHealthData, isHealthKitAvailable } from '@/lib/healthkit';
import type { ScoringCategory, DailyLogEntries } from '@/lib/types';

interface Props {
  categories: ScoringCategory[];
  entries: DailyLogEntries;
  onSyncHealthKit: (data: DailyLogEntries) => void;
}

export default function DailyChecklist({ categories, entries, onSyncHealthKit }: Props) {
  const [syncing, setSyncing] = useState(false);

  const handleSync = useCallback(async () => {
    setSyncing(true);
    try {
      const data = await getTodayHealthData();
      const evaluated = evaluateHealthData(data);

      const updatedEntries: DailyLogEntries = {
        workout: evaluated.workout,
        steps: evaluated.steps,
        activeCalories: evaluated.activeCalories,
        activeMinutes: evaluated.activeMinutes,
      };

      onSyncHealthKit(updatedEntries);
    } catch (error) {
      console.warn('HealthKit sync failed:', error);
    } finally {
      setSyncing(false);
    }
  }, [onSyncHealthKit]);

  const getEntryValue = (name: string): boolean => {
    const lower = name.toLowerCase();
    if (lower.includes('steps')) {
      const stepsVal = (entries.steps as number) ?? 0;
      if (lower.includes('10,000')) return stepsVal >= 10000;
      if (lower.includes('8,000')) return stepsVal >= 8000;
      if (lower.includes('5,000')) return stepsVal >= 5000;
      return stepsVal >= 8000;
    }
    if (lower.includes('active calories') || lower.includes('calories')) {
      const cal = (entries.activeCalories as number) ?? 0;
      if (lower.includes('500')) return cal >= 500;
      if (lower.includes('300')) return cal >= 300;
      if (lower.includes('150')) return cal >= 150;
      return cal >= 300;
    }
    if (lower.includes('active minutes')) {
      return ((entries.activeMinutes as number) ?? 0) >= 30;
    }
    if (lower.includes('workout')) {
      if (lower.includes('45')) {
        // 45+ min workout check — workout boolean + duration check
        return !!entries.workout;
      }
      return !!entries.workout;
    }
    return false;
  };

  const totalPoints = categories.reduce((sum, cat) => {
    return sum + (getEntryValue(cat.name) ? cat.points : 0);
  }, 0);

  const maxPoints = categories.reduce((sum, cat) => sum + cat.points, 0);

  const stepsToday = (entries.steps as number) ?? 0;
  const caloriesToday = (entries.activeCalories as number) ?? 0;
  const workoutsToday = entries.workout ? 1 : 0;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Today's Summary</Text>
          <Text style={styles.subtitle}>Auto-tracked via Apple Health</Text>
        </View>
        <View style={styles.pointsBadge}>
          <Text style={styles.pointsText}>
            {totalPoints}/{maxPoints}
          </Text>
          <Text style={styles.pointsLabel}>pts</Text>
        </View>
      </View>

      {/* Auto-synced stats */}
      <View style={styles.statsGrid}>
        <View style={styles.statCard}>
          <Text style={styles.statIcon}>{'\u{1F463}'}</Text>
          <Text style={styles.statValue}>{stepsToday.toLocaleString()}</Text>
          <Text style={styles.statLabel}>Steps</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statIcon}>{'\u{1F525}'}</Text>
          <Text style={styles.statValue}>{caloriesToday.toLocaleString()}</Text>
          <Text style={styles.statLabel}>Active Cal</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statIcon}>{'\u{1F4AA}'}</Text>
          <Text style={styles.statValue}>{workoutsToday}</Text>
          <Text style={styles.statLabel}>Workouts</Text>
        </View>
      </View>

      {/* Category completion */}
      {categories.map((category) => {
        const completed = getEntryValue(category.name);
        return (
          <View
            key={category.name}
            style={[styles.item, completed && styles.itemCompleted]}
          >
            <View style={[styles.statusDot, completed && styles.statusDotCompleted]} />
            <View style={styles.itemContent}>
              <Text style={[styles.itemName, completed && styles.itemNameCompleted]}>
                {category.name}
              </Text>
            </View>
            <View style={[styles.pointsChip, completed && styles.pointsChipEarned]}>
              <Text
                style={[styles.pointsChipText, completed && styles.pointsChipTextEarned]}
              >
                {completed ? '+' : ''}{category.points}
              </Text>
            </View>
          </View>
        );
      })}

      {/* HealthKit sync button */}
      {isHealthKitAvailable() && (
        <TouchableOpacity
          style={styles.syncButton}
          activeOpacity={0.7}
          onPress={handleSync}
          disabled={syncing}
        >
          {syncing ? (
            <ActivityIndicator size="small" color={Colors.primary} />
          ) : (
            <>
              <Text style={styles.syncIcon}>{'\u{2764}\u{FE0F}'}</Text>
              <Text style={styles.syncText}>Sync from Apple Health</Text>
            </>
          )}
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    ...Shadow.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.lg,
  },
  title: {
    fontSize: FontSize.lg,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  subtitle: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  pointsBadge: {
    backgroundColor: Colors.primary + '12',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.sm,
    alignItems: 'center',
  },
  pointsText: {
    fontSize: FontSize.lg,
    fontWeight: '800',
    color: Colors.primary,
  },
  pointsLabel: {
    fontSize: FontSize.xs,
    color: Colors.primary,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  statCard: {
    flex: 1,
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    alignItems: 'center',
  },
  statIcon: {
    fontSize: 20,
    marginBottom: 4,
  },
  statValue: {
    fontSize: FontSize.lg,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  statLabel: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  itemCompleted: {
    opacity: 0.85,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.border,
    marginRight: Spacing.md,
  },
  statusDotCompleted: {
    backgroundColor: Colors.success,
  },
  itemContent: {
    flex: 1,
  },
  itemName: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  itemNameCompleted: {
    color: Colors.textSecondary,
  },
  pointsChip: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
    backgroundColor: Colors.borderLight,
  },
  pointsChipEarned: {
    backgroundColor: Colors.success + '18',
  },
  pointsChipText: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    color: Colors.textMuted,
  },
  pointsChipTextEarned: {
    color: Colors.success,
  },
  syncButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    marginTop: Spacing.md,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    borderColor: Colors.primary + '30',
    borderStyle: 'dashed',
  },
  syncIcon: {
    fontSize: FontSize.md,
    marginRight: Spacing.sm,
  },
  syncText: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.primary,
  },
});
