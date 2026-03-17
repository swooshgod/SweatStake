import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Spacing, BorderRadius, FontSize } from '@/constants/theme';
import { useTheme } from '@/contexts/ThemeContext';

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
  const { Colors } = useTheme();
  const today = new Date().toISOString().split('T')[0];

  return (
    <View style={styles.container}>
      <Text style={[styles.title, { color: Colors.textPrimary }]}>This Week</Text>
      <View style={styles.row}>
        {days.slice(0, 7).map((day, index) => {
          const isToday = day.date === today;
          const ratio = day.maxPoints > 0 ? day.pointsEarned / day.maxPoints : 0;
          const isFull = ratio >= 1;
          const isPartial = ratio > 0 && ratio < 1;
          const isPast = new Date(day.date) < new Date(today);

          return (
            <View key={day.date} style={styles.dayColumn}>
              <Text style={[styles.dayLabel, { color: Colors.textMuted }, isToday && { color: Colors.primary }]}>
                {DAY_LABELS[index]}
              </Text>
              <View
                style={[
                  styles.dayCircle,
                  { backgroundColor: Colors.borderLight },
                  isFull && { backgroundColor: Colors.success },
                  isPartial && { backgroundColor: Colors.warning + '30', borderWidth: 2, borderColor: Colors.warning },
                  isToday && { borderWidth: 2, borderColor: Colors.primary },
                  isPast && !isFull && !isPartial && { backgroundColor: Colors.error + '15' },
                ]}
              >
                {isFull ? (
                  <Text style={[styles.dayCheckmark, { color: Colors.surface }]}>✓</Text>
                ) : (
                  <Text
                    style={[
                      styles.dayPoints,
                      { color: Colors.textMuted },
                      isToday && { color: Colors.primary },
                      isFull && { color: Colors.surface },
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
    marginBottom: Spacing.sm,
  },
  dayCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dayCheckmark: {
    fontSize: FontSize.sm,
    fontWeight: '700',
  },
  dayPoints: {
    fontSize: FontSize.sm,
    fontWeight: '700',
  },
});
