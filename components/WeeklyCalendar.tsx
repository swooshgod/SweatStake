import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, Spacing, BorderRadius, FontSize } from '@/constants/theme';

interface DayData {
  date: string;
  pointsEarned: number;
  maxPoints: number;
}

interface Props {
  days: DayData[];
}

const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

export default function WeeklyCalendar({ days }: Props) {
  const today = new Date().toISOString().split('T')[0];

  return (
    <View style={styles.container}>
      <Text style={styles.title}>This Week</Text>
      <View style={styles.row}>
        {days.slice(0, 7).map((day, index) => {
          const isToday = day.date === today;
          const ratio = day.maxPoints > 0 ? day.pointsEarned / day.maxPoints : 0;
          const isFull = ratio >= 1;
          const isPartial = ratio > 0 && ratio < 1;
          const isPast = new Date(day.date) < new Date(today);

          return (
            <View key={day.date} style={styles.dayColumn}>
              <Text style={[styles.dayLabel, isToday && styles.dayLabelToday]}>
                {DAY_LABELS[index]}
              </Text>
              <View
                style={[
                  styles.dayCircle,
                  isFull && styles.dayCircleFull,
                  isPartial && styles.dayCirclePartial,
                  isToday && styles.dayCircleToday,
                  isPast && !isFull && !isPartial && styles.dayCircleMissed,
                ]}
              >
                {isFull ? (
                  <Text style={styles.dayCheckmark}>✓</Text>
                ) : (
                  <Text
                    style={[
                      styles.dayPoints,
                      isToday && styles.dayPointsToday,
                      isFull && styles.dayPointsFull,
                    ]}
                  >
                    {day.pointsEarned}
                  </Text>
                )}
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: Spacing.lg,
  },
  title: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: Spacing.md,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  dayColumn: {
    alignItems: 'center',
    flex: 1,
  },
  dayLabel: {
    fontSize: FontSize.xs,
    fontWeight: '600',
    color: Colors.textMuted,
    marginBottom: Spacing.sm,
  },
  dayLabelToday: {
    color: Colors.primary,
  },
  dayCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.borderLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dayCircleFull: {
    backgroundColor: Colors.success,
  },
  dayCirclePartial: {
    backgroundColor: Colors.warning + '30',
    borderWidth: 2,
    borderColor: Colors.warning,
  },
  dayCircleToday: {
    borderWidth: 2,
    borderColor: Colors.primary,
  },
  dayCircleMissed: {
    backgroundColor: Colors.error + '15',
  },
  dayCheckmark: {
    color: '#fff',
    fontSize: FontSize.sm,
    fontWeight: '700',
  },
  dayPoints: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    color: Colors.textMuted,
  },
  dayPointsToday: {
    color: Colors.primary,
  },
  dayPointsFull: {
    color: '#fff',
  },
});
