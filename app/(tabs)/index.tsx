import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  FlatList,
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
        {/* Hero CTA */}
        <TouchableOpacity
          style={styles.createBanner}
          activeOpacity={0.85}
          onPress={() => {
            if (!isAuthenticated) {
              router.push('/(auth)/welcome');
              return;
            }
            router.push('/create');
          }}
        >
          <View style={styles.createBannerContent}>
            <View style={styles.createBannerText}>
              <Text style={styles.createBannerTitle}>Start a Competition</Text>
              <Text style={styles.createBannerSubtitle}>
                Challenge friends. Track progress. Win prizes.
              </Text>
            </View>
            <View style={styles.createBannerIcon}>
              <Ionicons name="add-circle" size={48} color="#fff" />
            </View>
          </View>
        </TouchableOpacity>

        {/* Active Competitions */}
        {isAuthenticated && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Your Competitions</Text>
            {myLoading ? (
              <ActivityIndicator color={Colors.primary} style={styles.loader} />
            ) : myComps.length > 0 ? (
              myComps.map((comp) => (
                <CompetitionCard key={comp.id} competition={comp} />
              ))
            ) : (
              <View style={styles.emptyState}>
                <Ionicons name="trophy-outline" size={48} color={Colors.textMuted} />
                <Text style={styles.emptyText}>No active competitions</Text>
                <Text style={styles.emptySubtext}>
                  Create one or join a public challenge below!
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Discover */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Discover</Text>
            <Text style={styles.sectionBadge}>
              {publicComps.length} open
            </Text>
          </View>
          {publicLoading ? (
            <ActivityIndicator color={Colors.primary} style={styles.loader} />
          ) : publicComps.length > 0 ? (
            <FlatList
              data={publicComps}
              keyExtractor={(item) => item.id}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.horizontalList}
              renderItem={({ item }) => (
                <CompetitionCard competition={item} variant="compact" />
              )}
            />
          ) : (
            <View style={styles.emptyState}>
              <Ionicons name="search-outline" size={48} color={Colors.textMuted} />
              <Text style={styles.emptyText}>No public competitions yet</Text>
              <Text style={styles.emptySubtext}>
                Be the first to create one!
              </Text>
            </View>
          )}
        </View>
      </ScrollView>
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
  createBanner: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
    marginBottom: Spacing.xxl,
    ...Shadow.lg,
  },
  createBannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  createBannerText: {
    flex: 1,
  },
  createBannerTitle: {
    fontSize: FontSize.xl,
    fontWeight: '800',
    color: '#fff',
    marginBottom: Spacing.xs,
  },
  createBannerSubtitle: {
    fontSize: FontSize.sm,
    color: 'rgba(255,255,255,0.85)',
    lineHeight: 18,
  },
  createBannerIcon: {
    marginLeft: Spacing.lg,
    opacity: 0.9,
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
  sectionBadge: {
    fontSize: FontSize.xs,
    fontWeight: '600',
    color: Colors.success,
    backgroundColor: Colors.success + '15',
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
    marginBottom: Spacing.md,
  },
  horizontalList: {
    paddingRight: Spacing.lg,
  },
  loader: {
    marginVertical: Spacing.xxl,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: Spacing.xxxl,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    ...Shadow.sm,
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
});
