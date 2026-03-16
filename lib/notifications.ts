/**
 * Podium — Push Notifications
 * Local notifications for competition events.
 */

import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// Configure how notifications appear when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// ---------------------------------------------------------------------------
// Permissions
// ---------------------------------------------------------------------------

export async function requestNotificationPermissions(): Promise<boolean> {
  if (Platform.OS !== 'ios') return false;

  const { status: existingStatus } = await Notifications.getPermissionsAsync();

  if (existingStatus === 'granted') return true;

  const { status } = await Notifications.requestPermissionsAsync({
    ios: {
      allowAlert: true,
      allowBadge: true,
      allowSound: true,
    },
  });

  return status === 'granted';
}

// ---------------------------------------------------------------------------
// Competition reminders
// ---------------------------------------------------------------------------

/**
 * Schedule a reminder 24 hours before competition ends.
 * Returns the notification identifier, or empty string if trigger time passed.
 */
export async function scheduleCompetitionEndingReminder(
  competitionId: string,
  competitionName: string,
  endDate: Date
): Promise<string> {
  const triggerDate = new Date(endDate.getTime() - 24 * 60 * 60 * 1000);

  if (triggerDate <= new Date()) return '';

  const id = await Notifications.scheduleNotificationAsync({
    identifier: `${competitionId}_24h`,
    content: {
      title: '⏰ Competition ending tomorrow!',
      body: `"${competitionName}" ends in 24 hours. Check the leaderboard!`,
      data: { competitionId, type: 'ending_24h' },
    },
    trigger: { date: triggerDate },
  });

  return id;
}

/**
 * Schedule a reminder 1 hour before competition ends.
 */
export async function scheduleCompetitionEndingReminder1Hour(
  competitionId: string,
  competitionName: string,
  endDate: Date
): Promise<string> {
  const triggerDate = new Date(endDate.getTime() - 60 * 60 * 1000);

  if (triggerDate <= new Date()) return '';

  const id = await Notifications.scheduleNotificationAsync({
    identifier: `${competitionId}_1h`,
    content: {
      title: '🔥 Last hour!',
      body: `"${competitionName}" ends in 1 hour. Give it everything!`,
      data: { competitionId, type: 'ending_1h' },
    },
    trigger: { date: triggerDate },
  });

  return id;
}

/**
 * Cancel all scheduled reminders for a competition.
 */
export async function cancelCompetitionReminders(competitionId: string): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(`${competitionId}_24h`);
  await Notifications.cancelScheduledNotificationAsync(`${competitionId}_1h`);
}

// ---------------------------------------------------------------------------
// Event notifications (immediate)
// ---------------------------------------------------------------------------

/**
 * Fire an immediate notification when user wins a competition.
 */
export async function sendWinnerNotification(
  competitionName: string,
  prizeDisplay: string
): Promise<void> {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: '🏆 You won!',
      body: `"${competitionName}" — ${prizeDisplay} is on its way!`,
      data: { type: 'winner' },
    },
    trigger: null, // immediate
  });
}

/**
 * Notify user when their leaderboard rank changes.
 */
export async function sendLeaderboardChangeNotification(
  competitionName: string,
  newRank: number
): Promise<void> {
  const emoji = newRank === 1 ? '🥇' : newRank === 2 ? '🥈' : newRank === 3 ? '🥉' : '📈';

  await Notifications.scheduleNotificationAsync({
    content: {
      title: `${emoji} You're now #${newRank}!`,
      body: `You moved to rank #${newRank} in "${competitionName}"`,
      data: { type: 'rank_change', rank: newRank },
    },
    trigger: null,
  });
}

/**
 * Notify user when someone joins their competition.
 */
export async function sendNewParticipantNotification(
  competitionName: string,
  participantCount: number,
  maxParticipants: number
): Promise<void> {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: '👥 New competitor joined!',
      body: `"${competitionName}" now has ${participantCount}/${maxParticipants} players`,
      data: { type: 'new_participant' },
    },
    trigger: null,
  });
}

/**
 * Notify user when they've been reported (trust system).
 */
export async function sendReportReceivedNotification(): Promise<void> {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: '⚠️ Activity flagged',
      body: 'Your recent activity was flagged for review. Keep competing clean!',
      data: { type: 'report_received' },
    },
    trigger: null,
  });
}
