import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Alert,
  Modal,
} from 'react-native';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { saveTrip, getTrips, cleanupInvalidTrips } from '@/lib/tripStore';
import { useRobinhoodTheme } from '@/hooks/use-robinhood-theme';

const BACKGROUND_LOCATION_TASK = 'BACKGROUND_LOCATION_TASK';
const TRIPS_STORAGE_KEY = 'mileage_trips';
const ACTIVE_SHIFT_KEY = 'active_shift_state';

interface LocationData {
  latitude: number;
  longitude: number;
  timestamp: number;
}

// Define the background task
TaskManager.defineTask(BACKGROUND_LOCATION_TASK, async ({ data, error }) => {
  if (error) {
    console.error('Background location task error:', error);
    return;
  }
  
  if (data) {
    const { locations } = data as { locations: Location.LocationObject[] };
    locations.forEach((location) => {
      console.log('Background location:', location.coords.latitude, location.coords.longitude);
      
      // Get the last location from storage
      AsyncStorage.getItem('current_trip_locations').then((stored) => {
        if (stored) {
          const locations: LocationData[] = JSON.parse(stored);
          const lastLocation = locations[locations.length - 1];
          
          if (lastLocation) {
            // Calculate distance using Haversine formula
            const distance = calculateDistance(
              lastLocation.latitude,
              lastLocation.longitude,
              location.coords.latitude,
              location.coords.longitude
            );
            
            // Save new location
            const newLocation: LocationData = {
              latitude: location.coords.latitude,
              longitude: location.coords.longitude,
              timestamp: location.timestamp || Date.now(),
            };
            
            locations.push(newLocation);
            AsyncStorage.setItem('current_trip_locations', JSON.stringify(locations));
          }
        }
      });
    });
  }
});

// Haversine formula to calculate distance between two points in miles
function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 3959; // Earth's radius in miles
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

interface ActiveShiftState {
  startTime: number;
  startLat: number;
  startLng: number;
  currentMiles: number;
  lastUpdateTimestamp: number;
  status: 'active';
}

interface MileageTrackerProps {
  onTripSaved?: () => void;
}

export default function MileageTracker({ onTripSaved }: MileageTrackerProps = {}) {
  const { colors } = useRobinhoodTheme();
  const [isTracking, setIsTracking] = useState(false);
  const [totalMiles, setTotalMiles] = useState(0);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [locations, setLocations] = useState<LocationData[]>([]);
  const [showRecoveryModal, setShowRecoveryModal] = useState(false);
  const [recoveredShift, setRecoveredShift] = useState<ActiveShiftState | null>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isSavingRef = useRef(false); // Prevent double submission

  // Save active shift state to AsyncStorage on every GPS update
  const saveShiftState = async (miles: number) => {
    if (!startTime) return;
    const state: ActiveShiftState = {
      startTime,
      startLat: locations[0]?.latitude ?? 0,
      startLng: locations[0]?.longitude ?? 0,
      currentMiles: miles,
      lastUpdateTimestamp: Date.now(),
      status: 'active',
    };
    await AsyncStorage.setItem(ACTIVE_SHIFT_KEY, JSON.stringify(state));
  };

  const clearShiftState = async () => {
    await AsyncStorage.removeItem(ACTIVE_SHIFT_KEY).catch(console.error);
  };

  // Check for recovered shift on mount
  useEffect(() => {
    const checkForActiveShift = async () => {
      try {
        const stored = await AsyncStorage.getItem(ACTIVE_SHIFT_KEY);
        if (stored) {
          const shift: ActiveShiftState = JSON.parse(stored);
          console.log('🔄 Restoring shift from AsyncStorage');
          const hoursAgo = (Date.now() - shift.startTime) / (1000 * 60 * 60);
          setRecoveredShift(shift);
          setShowRecoveryModal(true);
          if (hoursAgo > 24) {
            console.log('⚠️ Recovered shift is over 24 hours old');
          }
        }
      } catch (err) {
        console.error('Error checking for active shift:', err);
      }
    };
    checkForActiveShift();
  }, []);

  const handleResumeShift = async () => {
    if (!recoveredShift) return;
    console.log('▶️ Resuming shift from saved state');
    setStartTime(recoveredShift.startTime);
    setTotalMiles(recoveredShift.currentMiles);
    setShowRecoveryModal(false);

    // Load GPS points from storage
    const stored = await AsyncStorage.getItem('current_trip_locations');
    if (stored) {
      const tripLocations: LocationData[] = JSON.parse(stored);
      setLocations(tripLocations);
    }
    setIsTracking(true);

    // Re-start location subscription
    const location = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.BestForNavigation,
    });
    locationSubscriptionRef.current = await Location.watchPositionAsync(
      { accuracy: Location.Accuracy.BestForNavigation, distanceInterval: 5, timeInterval: 1000 },
      (loc) => {
        const newLocation: LocationData = {
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
          timestamp: loc.timestamp || Date.now(),
        };
        setLocations((prev) => {
          const updated = [...prev, newLocation];
          AsyncStorage.setItem('current_trip_locations', JSON.stringify(
            updated.length > 1000 ? updated.filter((_, i) => i % 2 === 0 || i === updated.length - 1) : updated
          ));
          return updated;
        });
      }
    );
    setRecoveredShift(null);
  };

  const handleEndRecoveredShift = async () => {
    if (!recoveredShift) return;
    console.log('⏹️ Ending recovered shift');
    setShowRecoveryModal(false);
    const endTime = recoveredShift.lastUpdateTimestamp;
    const duration = Math.floor((endTime - recoveredShift.startTime) / 1000);
    await saveShiftAndToast(recoveredShift.startTime, endTime, recoveredShift.currentMiles, duration);
    await clearShiftState();
    setRecoveredShift(null);
  };

  useEffect(() => {
    // Request permissions on mount
    requestPermissions();

    // Cleanup interval and location subscription on unmount
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      if (locationSubscriptionRef.current) {
        locationSubscriptionRef.current.remove();
      }
    };
  }, []);

  // Cleanup invalid trips on mount
  useEffect(() => {
    const cleanup = async () => {
      try {
        await cleanupInvalidTrips();
        if (onTripSaved) {
          onTripSaved();
        }
      } catch (error) {
        console.error('Error cleaning up invalid trips:', error);
      }
    };
    cleanup();
  }, []);

  useEffect(() => {
    // Load current trip data if tracking
    if (isTracking) {
      loadCurrentTrip();
    }
    // REMOVED: No longer auto-saving when isTracking becomes false
    // Trip is saved only through the earnings modal flow
  }, [isTracking]);

  useEffect(() => {
    // Calculate total miles from locations
    if (locations.length > 1) {
      let total = 0;
      for (let i = 1; i < locations.length; i++) {
        total += calculateDistance(
          locations[i - 1].latitude,
          locations[i - 1].longitude,
          locations[i].latitude,
          locations[i].longitude
        );
      }
      setTotalMiles(total);
      // Persist shift state on every GPS update
      if (isTracking && startTime) {
        console.log(`📍 GPS update saved: ${total.toFixed(2)} miles`);
        saveShiftState(total);
      }
    } else {
      setTotalMiles(0);
    }
  }, [locations]);

  useEffect(() => {
    // Timer for elapsed time
    if (isTracking && startTime) {
      intervalRef.current = setInterval(() => {
        setElapsedTime(Math.floor((Date.now() - startTime) / 1000));
      }, 1000);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      setElapsedTime(0);
    }
  }, [isTracking, startTime]);

  useEffect(() => {
    // Pulsing animation when tracking
    if (isTracking) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 0.7,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      pulseAnim.setValue(1);
    }
  }, [isTracking]);

  const requestPermissions = async (): Promise<boolean> => {
    // Step 1: Foreground permission
    const { status: foregroundStatus } = await Location.requestForegroundPermissionsAsync();
    if (foregroundStatus !== 'granted') {
      Alert.alert('Permission Denied', 'Location permission is required to track mileage.');
      return false;
    }

    // Step 2: Expo Go compatibility (background permission request can crash)
    if (Constants.appOwnership === 'expo') {
      return true;
    }

    // Step 3: Background permission (best-effort)
    try {
      await Location.requestBackgroundPermissionsAsync();
    } catch (e) {
      console.log('Bg failed');
    }

    return true;
  };

  const loadCurrentTrip = async () => {
    try {
      const stored = await AsyncStorage.getItem('current_trip_locations');
      if (stored) {
        const tripLocations: LocationData[] = JSON.parse(stored);
        setLocations(tripLocations);
      }
    } catch (error) {
      console.error('Error loading current trip:', error);
    }
  };

  const locationSubscriptionRef = useRef<Location.LocationSubscription | null>(null);

  const startTracking = async () => {
    try {
      // Get initial location
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.BestForNavigation,
      });

      const initialLocation: LocationData = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        timestamp: location.timestamp || Date.now(),
      };

      // Initialize trip
      setLocations([initialLocation]);
      setStartTime(Date.now());
      setIsTracking(true);

      // Start foreground location updates (for real-time UI updates)
      locationSubscriptionRef.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.BestForNavigation,
          distanceInterval: 5, // 5 meters (approx 15 feet)
          timeInterval: 1000, // 1 second
        },
        (location) => {
          const newLocation: LocationData = {
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
            timestamp: location.timestamp || Date.now(),
          };

          setLocations((prev) => {
            const updated = [...prev, newLocation];
            // Save to AsyncStorage for background task sync
            AsyncStorage.setItem('current_trip_locations', JSON.stringify(updated));
            return updated;
          });
        }
      );

      // Start background location updates
      await Location.startLocationUpdatesAsync(BACKGROUND_LOCATION_TASK, {
        accuracy: Location.Accuracy.BestForNavigation, // Highest possible accuracy
        distanceInterval: 5, // Update every 5 meters (approx 15 feet)
        deferredUpdatesInterval: 1000, // Minimum 1 second between updates
        foregroundService: { // Required for Android background tracking
          notificationTitle: "Tracking Mileage",
          notificationBody: "GigTax is tracking your drive in the background.",
        },
      });

      // Save initial location and shift state
      await AsyncStorage.setItem('current_trip_locations', JSON.stringify([initialLocation]));
      console.log('💾 Saving shift state to AsyncStorage');
      const shiftState: ActiveShiftState = {
        startTime: Date.now(),
        startLat: initialLocation.latitude,
        startLng: initialLocation.longitude,
        currentMiles: 0,
        lastUpdateTimestamp: Date.now(),
        status: 'active',
      };
      await AsyncStorage.setItem(ACTIVE_SHIFT_KEY, JSON.stringify(shiftState));
    } catch (error) {
      console.error('Error starting tracking:', error);
      Alert.alert('Error', 'Failed to start location tracking');
    }
  };

  const stopTracking = async () => {
    // Check for zero/low mileage BEFORE stopping tracking
    if (startTime && locations.length > 0 && totalMiles < 0.1) {
      Alert.alert(
        'No Movement Detected',
        'You haven\'t driven anywhere yet. Are you sure you want to end this shift?',
        [
          {
            text: 'Cancel',
            style: 'cancel',
            // Don't stop tracking - user continues
          },
          {
            text: 'End Shift',
            style: 'default',
            onPress: () => {
              // User confirmed - proceed with stop
              proceedWithStopTracking();
            },
          },
        ]
      );
      return;
    }

    // Normal flow - proceed with stopping
    proceedWithStopTracking();
  };

  const proceedWithStopTracking = async () => {
    if (!startTime || locations.length === 0) {
      setIsTracking(false);
      setLocations([]);
      setStartTime(null);
      setTotalMiles(0);
      setElapsedTime(0);
      AsyncStorage.removeItem('current_trip_locations').catch(console.error);
      return;
    }
    try {
      // Attempt to stop foreground location updates
      if (locationSubscriptionRef.current) {
        try {
          locationSubscriptionRef.current.remove();
        } catch (error) {
          console.log('Foreground location stop error (ignored):', error);
        }
        locationSubscriptionRef.current = null;
      }

      // Attempt to stop background location updates
      try {
        const hasStarted = await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
        if (hasStarted) {
          await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
        }
      } catch (error) {
        console.log('Background location stop error (ignored):', error);
      }
    } catch (error) {
      console.log('GPS Stop Error (Ignored to allow UI flow):', error);
    } finally {
      setIsTracking(false);

      if (startTime && locations.length > 0) {
        const endTime = Date.now();
        const finalDuration = Math.floor((endTime - startTime) / 1000);
        const finalMiles = totalMiles;
        await saveShiftAndToast(startTime, endTime, finalMiles, finalDuration);
      } else {
        AsyncStorage.removeItem('current_trip_locations').catch(console.error);
        setLocations([]);
        setStartTime(null);
        setTotalMiles(0);
        setElapsedTime(0);
      }
    }
  };

  const formatTimeForStore = (seconds: number): string => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const saveShiftAndToast = async (
    startTs: number,
    endTs: number,
    finalMiles: number,
    finalDuration: number
  ) => {
    if (!startTs || !endTs || startTs <= 0 || endTs <= 0) {
      AsyncStorage.removeItem('current_trip_locations').catch(console.error);
      setLocations([]);
      setStartTime(null);
      setTotalMiles(0);
      setElapsedTime(0);
      return;
    }
    const startDate = new Date(startTs);
    const endDate = new Date(endTs);
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      AsyncStorage.removeItem('current_trip_locations').catch(console.error);
      setLocations([]);
      setStartTime(null);
      setTotalMiles(0);
      setElapsedTime(0);
      return;
    }
    const tripDate = startDate.toISOString().split('T')[0];
    const startTimeFormatted = startDate.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
    const endTimeFormatted = endDate.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
    const durationFormatted = formatTimeForStore(finalDuration);

    if (isSavingRef.current) return;
    isSavingRef.current = true;

    try {
      const firstLoc = locations[0];
      const lastLoc = locations[locations.length - 1];
      await saveTrip({
        date: tripDate,
        miles: finalMiles,
        duration: durationFormatted,
        startTime: startTimeFormatted,
        endTime: endTimeFormatted,
        earnings: 0,
        businessPurpose: 'Gig driving',
        startLat: firstLoc?.latitude,
        startLng: firstLoc?.longitude,
        endLat: lastLoc?.latitude,
        endLng: lastLoc?.longitude,
      });
      console.log('✅ Shift ended and saved to Supabase');
      await AsyncStorage.removeItem('current_trip_locations');
      await clearShiftState();
      setLocations([]);
      setStartTime(null);
      setTotalMiles(0);
      setElapsedTime(0);
      if (onTripSaved) onTripSaved();
      Alert.alert('Success', "Shift saved! We'll scan for earnings automatically.");
    } catch (e) {
      console.error('Error saving trip:', e);
      Alert.alert('Warning', 'Trip could not be saved.');
    } finally {
      isSavingRef.current = false;
    }
  };

  // Cleanup function - reset state after trip is saved
  useEffect(() => {
    if (!isTracking && startTime === null && locations.length === 0) {
      // Trip has been saved, cleanup AsyncStorage
      AsyncStorage.removeItem('current_trip_locations').catch(console.error);
    }
  }, [isTracking, startTime, locations.length]);

  const formatTime = (seconds: number): string => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const handleToggleTracking = () => {
    if (isTracking) {
      stopTracking();
    } else {
      startTracking();
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Shift Recovery Modal */}
      <Modal visible={showRecoveryModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.background }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              Active Shift Found
            </Text>
            <Text style={[styles.modalBody, { color: colors.textSecondary }]}>
              {recoveredShift && (Date.now() - recoveredShift.startTime) > 24 * 60 * 60 * 1000
                ? 'This shift started over 24 hours ago. Do you want to resume or end it?'
                : `You have an active shift from ${recoveredShift ? new Date(recoveredShift.startTime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }) : ''}`}
            </Text>
            <Text style={[styles.modalMiles, { color: colors.primary }]}>
              {recoveredShift?.currentMiles.toFixed(2) ?? '0'} miles
            </Text>
            <TouchableOpacity
              style={[styles.modalButton, { backgroundColor: colors.primary }]}
              onPress={handleResumeShift}
            >
              <Text style={[styles.modalButtonText, { color: colors.background }]}>Resume Shift</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalButton, { backgroundColor: colors.error }]}
              onPress={handleEndRecoveredShift}
            >
              <Text style={[styles.modalButtonText, { color: colors.background }]}>End Shift</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <View style={styles.statsContainer}>
        <View style={styles.statBox}>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Miles</Text>
          <Text style={[styles.statValue, { color: colors.text }]}>{totalMiles.toFixed(2)}</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Time</Text>
          <Text style={[styles.statValue, { color: colors.text }]}>{formatTime(elapsedTime)}</Text>
        </View>
      </View>

      <TouchableOpacity
        style={[
          styles.trackingButton,
          { 
            backgroundColor: isTracking ? colors.error : colors.primary,
            shadowColor: colors.border,
          },
        ]}
        onPress={handleToggleTracking}
        activeOpacity={0.8}>
        <Animated.View
          style={[
            styles.buttonInner,
            isTracking && { opacity: pulseAnim },
          ]}>
          <Text style={[styles.buttonText, { color: colors.background }]}>
            {isTracking ? 'End Shift' : 'Start Shift'}
          </Text>
        </Animated.View>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 60,
  },
  statsContainer: {
    flexDirection: 'row',
    gap: 32,
    marginBottom: 48,
  },
  statBox: {
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 20,
    marginBottom: 8,
    fontWeight: '400',
  },
  statValue: {
    fontSize: 48,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  trackingButton: {
    width: 200,
    height: 200,
    borderRadius: 100,
    justifyContent: 'center',
    alignItems: 'center',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  buttonInner: {
    width: '100%',
    height: '100%',
    borderRadius: 100,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonText: {
    fontSize: 28,
    fontWeight: 'bold',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    borderRadius: 20,
    padding: 28,
    width: '100%',
    maxWidth: 340,
    alignItems: 'center',
    gap: 12,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 4,
  },
  modalBody: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
  },
  modalMiles: {
    fontSize: 32,
    fontWeight: '700',
    marginVertical: 8,
  },
  modalButton: {
    width: '100%',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
