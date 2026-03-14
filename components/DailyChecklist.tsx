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
  onToggle: (categoryName: string, value: boolean | number) => void;
  onSyncHealthKit: (data: DailyLogEntries) => void;
}

export default function DailyChecklist({ categories, entries, onToggle, onSyncHealthKit }: Props) {
  const [syncing, setSyncing] = useState(false);

  const handleSync = useCallback(async () => {
    setSyncing(true);
    try {
      const data = await getTodayHealthData();
      const evaluated = evaluateHealthData(data);

      const updatedEntries: DailyLogEntries = {
        ...entries,
        workout: evaluated.workout || entries.workout,
        steps: Math.max(evaluated.steps, (entries.steps as number) ?? 0),
      };

      onSyncHealthKit(updatedEntries);
    } catch (error) {
      console.warn('HealthKit sync failed:', error);
    } finally {
      setSyncing(false);
    }
  }, [entries, onSyncHealthKit]);

  const getEntryValue = (name: string): boolean => {
    const key = name.toLowerCase().split(' ')[0];
    const val = entries[key];
    if (typeof val === 'boolean') return val;
    if (typeof val === 'number' && key === 'steps') return val >= 8000;
    return false;
  };

  const totalPoints = categories.reduce((sum, cat) => {
    return sum + (getEntryValue(cat.name) ? cat.points : 0);
  }, 0);

  const maxPoints = categories.reduce((sum, cat) => sum + cat.points, 0);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Today's Checklist</Text>
          <Text style={styles.date}>
            {new Date().toLocaleDateString('en-US', {
              weekday: 'long',
              month: 'short',
              day: 'numeric',
            })}
          </Text>
        </View>
        <View style={styles.pointsBadge}>
          <Text style={styles.pointsText}>
            {totalPoints}/{maxPoints}
          </Text>
          <Text style={styles.pointsLabel}>pts</Text>
        </View>
      </View>

      {/* Checklist items */}
      {categories.map((category) => {
        const completed = getEntryValue(category.name);
        const key = category.name.toLowerCase().split(' ')[0];

        return (
          <TouchableOpacity
            key={category.name}
            style={[styles.item, completed && styles.itemCompleted]}
            activeOpacity={0.7}
            onPress={() => {
              if (key === 'steps') return; // Steps are auto-tracked
              onToggle(key, !completed);
            }}
          >
            <View style={[styles.checkbox, completed && styles.checkboxCompleted]}>
              {completed && <Text style={styles.checkmark}>✓</Text>}
            </View>
            <View style={styles.itemContent}>
              <Text style={[styles.itemName, completed && styles.itemNameCompleted]}>
                {category.name}
              </Text>
              {key === 'steps' && typeof entries.steps === 'number' && (
                <Text style={styles.itemDetail}>
                  {entries.steps.toLocaleString()} steps today
                </Text>
              )}
            </View>
            <View style={[styles.pointsChip, completed && styles.pointsChipEarned]}>
              <Text
                style={[styles.pointsChipText, completed && styles.pointsChipTextEarned]}
              >
                +{category.points}
              </Text>
            </View>
          </TouchableOpacity>
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
              <Text style={styles.syncIcon}>❤️</Text>
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
  date: {
    fontSize: FontSize.sm,
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
  checkbox: {
    width: 28,
    height: 28,
    borderRadius: BorderRadius.sm,
    borderWidth: 2,
    borderColor: Colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  checkboxCompleted: {
    backgroundColor: Colors.success,
    borderColor: Colors.success,
  },
  checkmark: {
    color: '#fff',
    fontSize: FontSize.sm,
    fontWeight: '700',
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
    textDecorationLine: 'line-through',
    color: Colors.textSecondary,
  },
  itemDetail: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    marginTop: 2,
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
