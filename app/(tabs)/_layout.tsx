import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { FontSize, Spacing } from '@/constants/theme';
import { useTheme } from '@/contexts/ThemeContext';

function TabHeader() {
  const { Colors, isDark, toggleTheme } = useTheme();

  return (
    <View style={[styles.header, { backgroundColor: Colors.background }]}>
      <View style={styles.headerInner}>
        <Text style={[styles.wordmark, { color: Colors.primary }]}>PODIUM</Text>
        <View style={[styles.wordmarkUnderline, { backgroundColor: Colors.primary }]} />
      </View>
      <TouchableOpacity
        onPress={toggleTheme}
        style={[styles.themeToggle, { backgroundColor: Colors.surfaceLight }]}
        activeOpacity={0.7}
      >
        <Ionicons
          name={isDark ? 'sunny' : 'moon'}
          size={18}
          color={isDark ? Colors.accentGold : Colors.accentPurple}
        />
      </TouchableOpacity>
    </View>
  );
}

export default function TabLayout() {
  const { Colors } = useTheme();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.textMuted,
        tabBarStyle: {
          backgroundColor: Colors.tabBar,
          borderTopColor: Colors.tabBarBorder,
          borderTopWidth: 1,
          paddingTop: 4,
          height: 88,
        },
        tabBarLabelStyle: {
          fontSize: FontSize.xs,
          fontWeight: '700',
          letterSpacing: 0.5,
        },
        headerStyle: {
          backgroundColor: Colors.background,
        },
        headerShadowVisible: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          headerTitle: () => <TabHeader />,
          title: 'Compete',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="flame" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          headerTitle: () => <TabHeader />,
          title: 'Profile',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    position: 'relative',
  },
  headerInner: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  wordmark: {
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 6,
  },
  wordmarkUnderline: {
    width: 24,
    height: 2,
    borderRadius: 1,
    marginTop: 3,
    opacity: 0.6,
  },
  themeToggle: {
    position: 'absolute',
    right: 0,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
