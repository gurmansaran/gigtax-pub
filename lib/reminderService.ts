/**
 * Quarterly Tax Reminder Service
 * Schedules push notifications for quarterly tax deadlines
 */

import * as Notifications from 'expo-notifications';
import { SchedulableTriggerInputTypes } from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Quarterly tax deadlines for 2025
export const QUARTERLY_DEADLINES = [
  { quarter: 'Q1', date: '2025-04-15', label: 'Q1 2025 (Jan-Mar)' },
  { quarter: 'Q2', date: '2025-06-16', label: 'Q2 2025 (Apr-Jun)' },
  { quarter: 'Q3', date: '2025-09-15', label: 'Q3 2025 (Jul-Sep)' },
  { quarter: 'Q4', date: '2026-01-15', label: 'Q4 2025 (Oct-Dec)' },
];

/**
 * Configure notification handler
 */
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

/**
 * Request notification permissions
 */
export async function requestNotificationPermissions(): Promise<boolean> {
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  return finalStatus === 'granted';
}

/**
 * Schedule quarterly tax reminders
 */
export async function scheduleQuarterlyReminders(quarterlyPayment: number): Promise<void> {
  try {
    const hasPermission = await requestNotificationPermissions();
    if (!hasPermission) {
      console.warn('Notification permissions not granted');
      return;
    }

    // Cancel existing reminders
    await Notifications.cancelAllScheduledNotificationsAsync();

    // Schedule reminders for each quarter
    for (const deadline of QUARTERLY_DEADLINES) {
      const deadlineDate = new Date(deadline.date);
      const now = new Date();

      // Only schedule if deadline is in the future
      if (deadlineDate > now) {
        // Schedule reminder 14 days before
        const twoWeeksBefore = new Date(deadlineDate);
        twoWeeksBefore.setDate(twoWeeksBefore.getDate() - 14);

        if (twoWeeksBefore > now) {
          await Notifications.scheduleNotificationAsync({
            content: {
              title: 'Quarterly Tax Payment in 2 Weeks',
              body: `Your Q${deadline.quarter} payment of $${quarterlyPayment.toFixed(2)} is due on ${deadline.date}. Start planning now.`,
              data: {
                type: 'quarterly_tax',
                quarter: deadline.quarter,
                amount: quarterlyPayment,
                deadline: deadline.date,
              },
              sound: true,
            },
            trigger: { type: SchedulableTriggerInputTypes.DATE, date: twoWeeksBefore },
          });
        }

        // Schedule reminder 7 days before
        const reminderDate = new Date(deadlineDate);
        reminderDate.setDate(reminderDate.getDate() - 7);

        if (reminderDate > now) {
          await Notifications.scheduleNotificationAsync({
            content: {
              title: 'Quarterly Tax Payment Due Soon',
              body: `Your Q${deadline.quarter} payment of $${quarterlyPayment.toFixed(2)} is due on ${deadline.date}. Tap to view details.`,
              data: {
                type: 'quarterly_tax',
                quarter: deadline.quarter,
                amount: quarterlyPayment,
                deadline: deadline.date,
              },
              sound: true,
            },
            trigger: { type: SchedulableTriggerInputTypes.DATE, date: reminderDate },
          });
        }

        // Schedule reminder 1 day before
        const dayBefore = new Date(deadlineDate);
        dayBefore.setDate(dayBefore.getDate() - 1);

        if (dayBefore > now) {
          await Notifications.scheduleNotificationAsync({
            content: {
              title: '⚠️ Quarterly Tax Due Tomorrow',
              body: `Don't forget: Your Q${deadline.quarter} payment of $${quarterlyPayment.toFixed(2)} is due tomorrow!`,
              data: {
                type: 'quarterly_tax',
                quarter: deadline.quarter,
                amount: quarterlyPayment,
                deadline: deadline.date,
              },
              sound: true,
            },
            trigger: { type: SchedulableTriggerInputTypes.DATE, date: dayBefore },
          });
        }
      }
    }

    // Store reminder settings
    await AsyncStorage.setItem('quarterly_reminders_enabled', 'true');
    await AsyncStorage.setItem('quarterly_payment_amount', quarterlyPayment.toString());
  } catch (error) {
    console.error('Error scheduling reminders:', error);
  }
}

/**
 * Cancel all scheduled reminders
 */
export async function cancelQuarterlyReminders(): Promise<void> {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
    await AsyncStorage.setItem('quarterly_reminders_enabled', 'false');
  } catch (error) {
    console.error('Error canceling reminders:', error);
  }
}

/**
 * Check if reminders are enabled
 */
export async function areRemindersEnabled(): Promise<boolean> {
  try {
    const value = await AsyncStorage.getItem('quarterly_reminders_enabled');
    return value === 'true';
  } catch (error) {
    return false;
  }
}
