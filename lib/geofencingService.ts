/**
 * Geofencing Service
 * Monitors when user leaves home and suggests starting mileage tracking
 */

import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import { AppState, AppStateStatus } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const HOME_ADDRESS_KEY = 'home_address_coords';
const GEOFENCE_RADIUS = 100; // meters

interface HomeCoordinates {
  latitude: number;
  longitude: number;
}

/**
 * Set home address coordinates from address string
 * Note: In production, you'd geocode the address to get coordinates
 * For now, we'll use the user's current location when they set their address
 */
export async function setHomeLocation(address: string): Promise<void> {
  try {
    // Request location permission
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      throw new Error('Location permission not granted');
    }

    // Get current location as home (in production, geocode the address)
    const location = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });

    const homeCoords: HomeCoordinates = {
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
    };

    await AsyncStorage.setItem(HOME_ADDRESS_KEY, JSON.stringify(homeCoords));
  } catch (error) {
    console.error('Error setting home location:', error);
    throw error;
  }
}

/**
 * Get home coordinates
 */
export async function getHomeLocation(): Promise<HomeCoordinates | null> {
  try {
    const data = await AsyncStorage.getItem(HOME_ADDRESS_KEY);
    if (!data) return null;
    return JSON.parse(data) as HomeCoordinates;
  } catch (error) {
    console.error('Error getting home location:', error);
    return null;
  }
}

/**
 * Calculate distance between two coordinates (Haversine formula)
 */
function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000; // Earth's radius in meters
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Check if user is outside home radius
 */
export async function checkIfOutsideHome(): Promise<boolean> {
  try {
    const homeCoords = await getHomeLocation();
    if (!homeCoords) return false;

    // Request location permission
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return false;

    // Get current location
    const location = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });

    const distance = calculateDistance(
      homeCoords.latitude,
      homeCoords.longitude,
      location.coords.latitude,
      location.coords.longitude
    );

    return distance > GEOFENCE_RADIUS;
  } catch (error) {
    console.error('Error checking if outside home:', error);
    return false;
  }
}

/**
 * Send notification suggesting to start tracking
 */
export async function sendTrackingSuggestion(): Promise<void> {
  try {
    // Request notification permissions
    const { status } = await Notifications.requestPermissionsAsync();
    if (status !== 'granted') return;

    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Start Tracking Mileage?',
        body: 'You left home. Do you want to start tracking mileage?',
        data: { type: 'geofence_tracking_suggestion' },
      },
      trigger: null, // Send immediately
    });
  } catch (error) {
    console.error('Error sending tracking suggestion:', error);
  }
}

/**
 * Initialize geofencing monitoring
 * Uses AppState to check location when app enters foreground
 */
export function initializeGeofencing(onOutsideHome?: () => void): () => void {
  let lastCheckTime = 0;
  const CHECK_INTERVAL = 30000; // Check every 30 seconds when app is active

  const checkLocation = async () => {
    const now = Date.now();
    if (now - lastCheckTime < CHECK_INTERVAL) return;
    lastCheckTime = now;

    const isOutside = await checkIfOutsideHome();
    if (isOutside) {
      // Check if we've already sent a notification recently
      const lastNotification = await AsyncStorage.getItem('last_geofence_notification');
      const lastNotificationTime = lastNotification ? parseInt(lastNotification) : 0;
      const timeSinceLastNotification = now - lastNotificationTime;

      // Only send notification if it's been more than 1 hour since last one
      if (timeSinceLastNotification > 3600000) {
        await sendTrackingSuggestion();
        await AsyncStorage.setItem('last_geofence_notification', now.toString());
        
        if (onOutsideHome) {
          onOutsideHome();
        }
      }
    }
  };

  // Check when app comes to foreground
  const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
    if (nextAppState === 'active') {
      checkLocation();
    }
  });

  // Also check immediately
  checkLocation();

  // Return cleanup function
  return () => {
    subscription.remove();
  };
}
