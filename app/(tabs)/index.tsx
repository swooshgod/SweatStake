import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, BorderRadius, FontSize, Shadow } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { useMyCompetitions, usePublicCompetitions } from '@/hooks/useCompetitions';
import CompetitionCard from '@/components/CompetitionCard';

export default function HomeScreen() {
  const router = useRouter();
  const { profile, isAuthenticated } = useAuth();
  const { competitions: myComps, loading: myLoading, refetch: refetchMy } = useMyCompetitions(profile?.id);
  const { competitions: publicComps, loading: publicLoading, refetch: refetchPublic } = usePublicCompetitions();

  const [refreshing, setRefreshing] = React.useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refetchMy(), refetchPublic()]);
    setRefreshing(false);
  };

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Colors.primary}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Your Competitions — only if authenticated and has competitions */}
        {isAuthenticated && myComps.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Your Competitions</Text>
            {myLoading ? (
              <ActivityIndicator color={Colors.primary} style={styles.loader} />
            ) : (
              myComps.map((comp) => (
                <CompetitionCard key={comp.id} competition={comp} />
              ))
            )}
          </View>
        )}

        {/* Live Competitions Feed */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Live Competitions</Text>
            {publicComps.length > 0 && (
              <View style={styles.sectionBadgeContainer}>
                <View style={styles.liveDot} />
                <Text style={styles.sectionBadge}>
                  {publicComps.length} open
                </Text>
              </View>
            )}
          </View>
          {publicLoading ? (
            <ActivityIndicator color={Colors.primary} style={styles.loader} />
          ) : publicComps.length > 0 ? (
            publicComps.map((comp) => (
              <CompetitionCard key={comp.id} competition={comp} />
            ))
          ) : (
            <View style={styles.emptyState}>
              <Ionicons name="trophy-outline" size={48} color={Colors.textMuted} />
              <Text style={styles.emptyText}>No live competitions yet</Text>
              <Text style={styles.emptySubtext}>
                Be the first to create one!
              </Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Floating Action Button */}
      <TouchableOpacity
        style={styles.fab}
        activeOpacity={0.85}
        onPress={() => {
          if (!isAuthenticated) {
            router.push('/(auth)/welcome');
            return;
          }
          router.push('/create');
        }}
      >
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    padding: Spacing.lg,
    paddingBottom: 100,
  },
  section: {
    marginBottom: Spacing.xxl,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    fontSize: FontSize.lg,
    fontWeight: '800',
    color: Colors.textPrimary,
    marginBottom: Spacing.md,
  },
  sectionBadgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.success + '15',
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
    marginBottom: Spacing.md,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.success,
  },
  sectionBadge: {
    fontSize: FontSize.xs,
    fontWeight: '600',
    color: Colors.success,
  },
  loader: {
    marginVertical: Spacing.xxl,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: Spacing.xxxl,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  emptyText: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginTop: Spacing.md,
  },
  emptySubtext: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    marginTop: Spacing.xs,
  },
  fab: {
    position: 'absolute',
    bottom: 100,
    right: Spacing.xl,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    ...Shadow.lg,
  },
});
