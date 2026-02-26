/**
 * Sync Service
 * Centralized sync status management for expense and trip data.
 * Tracks last-synced timestamp, manages sync state, and provides retry logic.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const LAST_SYNCED_KEY = 'gigtax_last_synced_at';

export type SyncStatus = 'synced' | 'syncing' | 'error' | 'offline' | 'idle';

// Global sync state (in-memory, UI reads via hooks)
let currentSyncStatus: SyncStatus = 'idle';
let syncListeners: Array<(status: SyncStatus) => void> = [];

export function getSyncStatus(): SyncStatus {
    return currentSyncStatus;
}

export function setSyncStatus(status: SyncStatus): void {
    currentSyncStatus = status;
    syncListeners.forEach((l) => l(status));
}

export function onSyncStatusChange(listener: (status: SyncStatus) => void): () => void {
    syncListeners.push(listener);
    return () => {
        syncListeners = syncListeners.filter((l) => l !== listener);
    };
}

/**
 * Get last-synced timestamp
 */
export async function getLastSyncedAt(): Promise<string | null> {
    try {
        return await AsyncStorage.getItem(LAST_SYNCED_KEY);
    } catch {
        return null;
    }
}

/**
 * Set last-synced timestamp to now
 */
export async function setLastSyncedAt(): Promise<void> {
    try {
        await AsyncStorage.setItem(LAST_SYNCED_KEY, new Date().toISOString());
    } catch (e) {
        console.error('Error setting last synced:', e);
    }
}

/**
 * Format relative time from a date string
 */
export function formatLastSynced(isoDate: string | null): string {
    if (!isoDate) return 'Never synced';

    const date = new Date(isoDate);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);

    if (diffMin < 1) return 'Just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    const diffDay = Math.floor(diffHr / 24);
    return `${diffDay}d ago`;
}

/**
 * Run a sync operation with retry logic
 */
export async function withSyncRetry<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            return await operation();
        } catch (error: any) {
            lastError = error;
            // Exponential backoff: 1s, 2s, 4s
            const delay = Math.pow(2, attempt) * 1000;
            await new Promise((resolve) => setTimeout(resolve, delay));
        }
    }

    throw lastError;
}
