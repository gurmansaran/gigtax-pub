/**
 * Trip Store
 * AsyncStorage cache with Supabase sync for offline-first mileage tracking.
 * Primary source of truth: Supabase (mileage_entries table)
 * Local cache: AsyncStorage for fast reads and offline support
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';
import { setSyncStatus, setLastSyncedAt } from './syncService';

export interface Trip {
  id: string;
  date: string;
  miles: number;
  duration: string;
  startTime: string;
  endTime: string;
  earnings?: number;
  businessPurpose?: string;
  startLat?: number;
  startLng?: number;
  endLat?: number;
  endLng?: number;
  pendingSync?: boolean;
}

const TRIPS_STORAGE_KEY = 'gigtax_trips';

/**
 * Generates a random ID for trips
 */
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Saves a trip to AsyncStorage and optionally to Supabase
 */
export async function saveTrip(trip: Omit<Trip, 'id'>, userId?: string): Promise<Trip> {
  try {
    const trips = await getTrips();
    const newTrip: Trip = {
      id: generateId(),
      ...trip,
    };

    // Try to save to Supabase first
    if (userId) {
      try {
        const { data, error } = await supabase
          .from('mileage_entries')
          .insert({
            user_id: userId,
            date: trip.date,
            start_time: trip.startTime,
            end_time: trip.endTime,
            miles: trip.miles,
            start_latitude: trip.startLat,
            start_longitude: trip.startLng,
            end_latitude: trip.endLat,
            end_longitude: trip.endLng,
            business_purpose: trip.businessPurpose,
            duration: trip.duration,
          })
          .select('id')
          .single();

        if (!error && data) {
          newTrip.id = data.id; // Use the Supabase-generated UUID
        } else {
          newTrip.pendingSync = true;
        }
      } catch {
        newTrip.pendingSync = true;
      }
    }

    const updatedTrips = [newTrip, ...trips];
    await AsyncStorage.setItem(TRIPS_STORAGE_KEY, JSON.stringify(updatedTrips));
    return newTrip;
  } catch (error) {
    console.error('Error saving trip:', error);
    throw error;
  }
}

/**
 * Gets all trips from AsyncStorage
 */
export async function getTrips(): Promise<Trip[]> {
  try {
    const data = await AsyncStorage.getItem(TRIPS_STORAGE_KEY);
    if (!data) return [];

    const trips: Trip[] = JSON.parse(data);
    return trips.sort((a, b) => {
      const dateCompare = new Date(b.date).getTime() - new Date(a.date).getTime();
      if (dateCompare !== 0) return dateCompare;
      return b.id.localeCompare(a.id);
    });
  } catch (error) {
    console.error('Error getting trips:', error);
    return [];
  }
}

/**
 * Clears all trips from storage
 */
export async function clearTrips(): Promise<void> {
  try {
    await AsyncStorage.removeItem(TRIPS_STORAGE_KEY);
  } catch (error) {
    console.error('Error clearing trips:', error);
    throw error;
  }
}

/**
 * Removes invalid trips from storage
 */
export async function cleanupInvalidTrips(): Promise<void> {
  try {
    const trips = await getTrips();
    const validTrips = trips.filter((trip) => {
      if (!trip.id || !trip.date || !trip.startTime || !trip.endTime) return false;
      const date = new Date(trip.date);
      if (isNaN(date.getTime()) || date.getTime() <= 0) return false;
      if (trip.startTime === 'Invalid Date' || trip.endTime === 'Invalid Date' ||
        trip.startTime === 'N/A' || trip.endTime === 'N/A') return false;
      return true;
    });

    if (validTrips.length !== trips.length) {
      await AsyncStorage.setItem(TRIPS_STORAGE_KEY, JSON.stringify(validTrips));
    }
  } catch (error) {
    console.error('Error cleaning up invalid trips:', error);
    throw error;
  }
}

/**
 * Updates a trip by ID with partial data
 */
export async function updateTrip(id: string, updates: Partial<Omit<Trip, 'id'>>): Promise<void> {
  try {
    const data = await AsyncStorage.getItem(TRIPS_STORAGE_KEY);
    if (!data) return;

    const trips: Trip[] = JSON.parse(data);
    const idx = trips.findIndex((t) => t.id === id);
    if (idx === -1) return;

    trips[idx] = { ...trips[idx], ...updates };
    await AsyncStorage.setItem(TRIPS_STORAGE_KEY, JSON.stringify(trips));

    // Also update in Supabase if it's a UUID (synced trip)
    if (id.includes('-') && id.length > 30) {
      try {
        await supabase
          .from('mileage_entries')
          .update({
            business_purpose: updates.businessPurpose,
            miles: updates.miles,
          })
          .eq('id', id);
      } catch {
        // Silently fail — local update is already saved
      }
    }
  } catch (error) {
    console.error('Error updating trip:', error);
    throw error;
  }
}

/**
 * Sync trips from Supabase → local cache
 */
export async function syncTripsFromSupabase(userId: string): Promise<void> {
  try {
    setSyncStatus('syncing');

    const { data, error } = await supabase
      .from('mileage_entries')
      .select('*')
      .eq('user_id', userId)
      .order('date', { ascending: false });

    if (error) throw error;

    if (data) {
      const trips: Trip[] = data.map((row: any) => ({
        id: row.id,
        date: row.date,
        miles: parseFloat(row.miles?.toString() || '0'),
        duration: row.duration || '0:00',
        startTime: row.start_time,
        endTime: row.end_time,
        startLat: row.start_latitude ? parseFloat(row.start_latitude) : undefined,
        startLng: row.start_longitude ? parseFloat(row.start_longitude) : undefined,
        endLat: row.end_latitude ? parseFloat(row.end_latitude) : undefined,
        endLng: row.end_longitude ? parseFloat(row.end_longitude) : undefined,
        businessPurpose: row.business_purpose,
      }));

      await AsyncStorage.setItem(TRIPS_STORAGE_KEY, JSON.stringify(trips));
    }

    await setLastSyncedAt();
    setSyncStatus('synced');
  } catch (error) {
    console.error('Error syncing trips from Supabase:', error);
    setSyncStatus('error');
  }
}

/**
 * Sync pending local trips to Supabase
 */
export async function syncPendingTrips(userId: string): Promise<void> {
  try {
    const trips = await getTrips();
    const pending = trips.filter((t) => t.pendingSync);

    for (const trip of pending) {
      try {
        const { data, error } = await supabase
          .from('mileage_entries')
          .insert({
            user_id: userId,
            date: trip.date,
            start_time: trip.startTime,
            end_time: trip.endTime,
            miles: trip.miles,
            start_latitude: trip.startLat,
            start_longitude: trip.startLng,
            end_latitude: trip.endLat,
            end_longitude: trip.endLng,
            business_purpose: trip.businessPurpose,
            duration: trip.duration,
          })
          .select('id')
          .single();

        if (!error && data) {
          // Update the local trip with the Supabase ID and remove pending flag
          const allTrips = await getTrips();
          const idx = allTrips.findIndex((t) => t.id === trip.id);
          if (idx !== -1) {
            allTrips[idx].id = data.id;
            allTrips[idx].pendingSync = false;
            await AsyncStorage.setItem(TRIPS_STORAGE_KEY, JSON.stringify(allTrips));
          }
        }
      } catch {
        // Skip this trip and try the next one
      }
    }
  } catch (error) {
    console.error('Error syncing pending trips:', error);
  }
}
