import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Spacing, BorderRadius, FontSize } from '@/constants/theme';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/hooks/useAuth';
import { useMyCompetitions, usePublicCompetitions } from '@/hooks/useCompetitions';
import CompetitionCard from '@/components/CompetitionCard';

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

export default function HomeScreen() {
  const router = useRouter();
  const { Colors, Shadow } = useTheme();
  const { profile, isAuthenticated } = useAuth();
  const { competitions: myComps, loading: myLoading, refetch: refetchMy } = useMyCompetitions(profile?.id);
  const { competitions: publicComps, loading: publicLoading, refetch: refetchPublic } = usePublicCompetitions();

  const [refreshing, setRefreshing] = React.useState(false);

  // Animated header gradient bar
  const headerAnim = useRef(new Animated.Value(0)).current;
  const greetingFade = useRef(new Animated.Value(0)).current;
  const greetingSlide = useRef(new Animated.Value(16)).current;
  const sectionFade = useRef(new Animated.Value(0)).current;
  const sectionSlide = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.timing(headerAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.parallel([
        Animated.timing(greetingFade, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.timing(greetingSlide, {
          toValue: 0,
          duration: 400,
          useNativeDriver: true,
        }),
      ]),
      Animated.parallel([
        Animated.timing(sectionFade, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.timing(sectionSlide, {
          toValue: 0,
          duration: 400,
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refetchMy(), refetchPublic()]);
    setRefreshing(false);
  };

  return (
    <View style={[styles.container, { backgroundColor: Colors.background }]}>
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
        {/* Animated gradient header accent */}
        <Animated.View
          style={[
            styles.headerAccent,
            {
              backgroundColor: Colors.primaryGlow,
              opacity: headerAnim,
            },
          ]}
        />

        {isAuthenticated && profile?.display_name && (
          <Animated.View
            style={{
              opacity: greetingFade,
              transform: [{ translateY: greetingSlide }],
            }}
          >
            <Text style={[styles.greeting, { color: Colors.textPrimary }]}>
              {getGreeting()},
            </Text>
            <Text style={[styles.greetingName, { color: Colors.primary }]}>
              {profile.display_name}
            </Text>
          </Animated.View>
        )}

        {/* Your Competitions — only if authenticated */}
        {isAuthenticated && (myLoading || myComps.length > 0) && (
          <Animated.View
            style={[
              styles.section,
              {
                opacity: sectionFade,
                transform: [{ translateY: sectionSlide }],
              },
            ]}
          >
            <Text style={[styles.sectionTitle, { color: Colors.textPrimary }]}>Your Competitions</Text>
            {myLoading ? (
              <ActivityIndicator color={Colors.primary} style={styles.loader} />
            ) : (
              myComps.map((comp, i) => (
                <CompetitionCard key={comp.id} competition={comp} index={i} />
              ))
            )}
          </Animated.View>
        )}

        {/* Live Competitions Feed */}
        <Animated.View
          style={[
            styles.section,
            {
              opacity: sectionFade,
              transform: [{ translateY: sectionSlide }],
            },
          ]}
        >
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: Colors.textPrimary }]}>Live Competitions</Text>
            {publicComps.length > 0 && (
              <View style={[styles.sectionBadgeContainer, { backgroundColor: Colors.success + '15' }]}>
                <View style={[styles.liveDot, { backgroundColor: Colors.success }]} />
                <Text style={[styles.sectionBadge, { color: Colors.success }]}>
                  {publicComps.length} open
                </Text>
              </View>
            )}
          </View>
          {publicLoading ? (
            <ActivityIndicator color={Colors.primary} style={styles.loader} />
          ) : publicComps.length > 0 ? (
            publicComps.map((comp, i) => (
              <CompetitionCard key={comp.id} competition={comp} index={i} />
            ))
          ) : (
            <View style={[styles.emptyState, { backgroundColor: Colors.surface, borderColor: Colors.border }]}>
              <Ionicons name="trophy-outline" size={48} color={Colors.primary} />
              <Text style={[styles.emptyText, { color: Colors.textPrimary }]}>No live competitions yet</Text>
              <Text style={[styles.emptySubtext, { color: Colors.textSecondary }]}>
                Create a challenge and invite your friends!
              </Text>
              <TouchableOpacity
                style={[styles.emptyButton, { backgroundColor: Colors.primary }]}
                onPress={() => {
                  if (!isAuthenticated) {
                    router.push('/(auth)/welcome');
                    return;
                  }
                  router.push('/create');
                }}
                activeOpacity={0.85}
              >
                <Text style={styles.emptyButtonText}>Create Competition</Text>
              </TouchableOpacity>
            </View>
          )}
        </Animated.View>
      </ScrollView>

      {/* Floating Action Button */}
      <TouchableOpacity
        style={[styles.fab, { backgroundColor: Colors.primary }, Shadow.lg]}
        activeOpacity={0.85}
        onPress={() => {
          if (!isAuthenticated) {
            router.push('/(auth)/welcome');
            return;
          }
          router.push('/create');
        }}
      >
        <Ionicons name="add" size={28} color={Colors.surface} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerAccent: {
    height: 120,
    marginHorizontal: -Spacing.lg,
    marginTop: -Spacing.lg,
    marginBottom: Spacing.lg,
    borderBottomLeftRadius: BorderRadius.xxl,
    borderBottomRightRadius: BorderRadius.xxl,
  },
  greeting: {
    fontSize: FontSize.xxxl,
    fontWeight: '800',
    marginBottom: 2,
  },
  greetingName: {
    fontSize: FontSize.xxxl,
    fontWeight: '900',
    marginBottom: Spacing.xxl,
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
    marginBottom: Spacing.md,
  },
  sectionBadgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
    marginBottom: Spacing.md,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  sectionBadge: {
    fontSize: FontSize.xs,
    fontWeight: '600',
  },
  loader: {
    marginVertical: Spacing.xxl,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: Spacing.xxxl,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
  },
  emptyText: {
    fontSize: FontSize.md,
    fontWeight: '600',
    marginTop: Spacing.md,
  },
  emptySubtext: {
    fontSize: FontSize.sm,
    marginTop: Spacing.xs,
  },
  emptyButton: {
    marginTop: Spacing.xl,
    paddingHorizontal: Spacing.xxl,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
  },
  emptyButtonText: {
    color: '#fff',
    fontSize: FontSize.md,
    fontWeight: '700',
  },
  fab: {
    position: 'absolute',
    bottom: 100,
    right: Spacing.xl,
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
