import { useState, useEffect, useCallback } from 'react';
import { logger } from '@/utils/logger';

/**
 * Online status state
 */
interface OnlineStatus {
    isOnline: boolean;
    wasOffline: boolean;
    lastOnline: Date | null;
    lastOffline: Date | null;
}

/**
 * Queued action for offline support
 */
interface QueuedAction {
    id: string;
    type: string;
    payload: unknown;
    timestamp: Date;
    retryCount: number;
    maxRetries: number;
}

/**
 * Hook for detecting online/offline status
 * 
 * @returns Object with online status information
 */
export const useOnlineStatus = () => {
    const [status, setStatus] = useState<OnlineStatus>({
        isOnline: navigator.onLine,
        wasOffline: false,
        lastOnline: navigator.onLine ? new Date() : null,
        lastOffline: navigator.onLine ? null : new Date(),
    });

    useEffect(() => {
        const handleOnline = () => {
            setStatus((prev) => ({
                ...prev,
                isOnline: true,
                wasOffline: !prev.isOnline,
                lastOnline: new Date(),
            }));
        };

        const handleOffline = () => {
            setStatus((prev) => ({
                ...prev,
                isOnline: false,
                wasOffline: false,
                lastOffline: new Date(),
            }));
        };

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    return status;
};

/**
 * Storage key for offline action queue
 */
const OFFLINE_QUEUE_KEY = 'sc-fleet-manager-offline-queue';

/**
 * Hook for queuing actions while offline
 * 
 * @returns Object with queue management functions
 */
export const useOfflineQueue = () => {
    const [queue, setQueue] = useState<QueuedAction[]>(() => {
        try {
            const stored = localStorage.getItem(OFFLINE_QUEUE_KEY);
            return stored ? JSON.parse(stored) : [];
        } catch {
            return [];
        }
    });

    const { isOnline, wasOffline } = useOnlineStatus();

    // Persist queue to localStorage
    useEffect(() => {
        try {
            localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
        } catch (error) {
            logger.error('Failed to persist offline queue:', error instanceof Error ? error : new Error(String(error)));
        }
    }, [queue]);

    /**
     * Add action to offline queue
     */
    const queueAction = useCallback((type: string, payload: unknown, maxRetries = 3): string => {
        const id = `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
        const action: QueuedAction = {
            id,
            type,
            payload,
            timestamp: new Date(),
            retryCount: 0,
            maxRetries,
        };

        setQueue((prev) => [...prev, action]);
        return id;
    }, []);

    /**
     * Remove action from queue
     */
    const removeAction = useCallback((id: string) => {
        setQueue((prev) => prev.filter((action) => action.id !== id));
    }, []);

    /**
     * Clear all queued actions
     */
    const clearQueue = useCallback(() => {
        setQueue([]);
    }, []);

    /**
     * Process a single queued action
     */
    const processAction = useCallback(async (
        action: QueuedAction,
        processor: (action: QueuedAction) => Promise<boolean>
    ): Promise<boolean> => {
        try {
            const success = await processor(action);
            if (success) {
                removeAction(action.id);
            } else if (action.retryCount < action.maxRetries) {
                setQueue((prev) =>
                    prev.map((a) =>
                        a.id === action.id ? { ...a, retryCount: a.retryCount + 1 } : a
                    )
                );
            } else {
                // Max retries exceeded, remove from queue
                removeAction(action.id);
            }
            return success;
        } catch (error) {
            logger.error('Failed to process queued action:', error instanceof Error ? error : new Error(String(error)));
            return false;
        }
    }, [removeAction]);

    /**
     * Process all queued actions
     */
    const processQueue = useCallback(async (
        processor: (action: QueuedAction) => Promise<boolean>
    ) => {
        const results = await Promise.all(
            queue.map((action) => processAction(action, processor))
        );
        return results;
    }, [queue, processAction]);

    return {
        queue,
        queueLength: queue.length,
        queueAction,
        removeAction,
        clearQueue,
        processAction,
        processQueue,
        isOnline,
        wasOffline,
    };
};

/**
 * Hook for offline data caching
 */
export const useOfflineCache = <T>(key: string, initialValue: T) => {
    const [value, setValue] = useState<T>(() => {
        try {
            const stored = localStorage.getItem(`sc-cache-${key}`);
            return stored ? JSON.parse(stored) : initialValue;
        } catch {
            return initialValue;
        }
    });

    const [lastUpdated, setLastUpdated] = useState<Date | null>(() => {
        try {
            const timestamp = localStorage.getItem(`sc-cache-${key}-timestamp`);
            return timestamp ? new Date(timestamp) : null;
        } catch {
            return null;
        }
    });

    const { isOnline } = useOnlineStatus();

    /**
     * Update cached value
     */
    const updateCache = useCallback((newValue: T) => {
        setValue(newValue);
        setLastUpdated(new Date());
        
        try {
            localStorage.setItem(`sc-cache-${key}`, JSON.stringify(newValue));
            localStorage.setItem(`sc-cache-${key}-timestamp`, new Date().toISOString());
        } catch (error) {
            logger.error('Failed to update cache:', error instanceof Error ? error : new Error(String(error)));
        }
    }, [key]);

    /**
     * Clear cached value
     */
    const clearCache = useCallback(() => {
        setValue(initialValue);
        setLastUpdated(null);
        
        try {
            localStorage.removeItem(`sc-cache-${key}`);
            localStorage.removeItem(`sc-cache-${key}-timestamp`);
        } catch (error) {
            logger.error('Failed to clear cache:', error instanceof Error ? error : new Error(String(error)));
        }
    }, [key, initialValue]);

    /**
     * Check if cache is stale (older than given duration in ms)
     */
    const isCacheStale = useCallback((maxAge: number): boolean => {
        if (!lastUpdated) return true;
        return Date.now() - lastUpdated.getTime() > maxAge;
    }, [lastUpdated]);

    return {
        value,
        updateCache,
        clearCache,
        lastUpdated,
        isCacheStale,
        isOnline,
    };
};

/**
 * Hook combining online status, queue, and visual feedback
 */
export const useOfflineSupport = () => {
    const onlineStatus = useOnlineStatus();
    const offlineQueue = useOfflineQueue();

    // Show notification when coming back online
    useEffect(() => {
        if (onlineStatus.wasOffline && onlineStatus.isOnline) {
            // Could trigger a toast notification here
            logger.info('Back online! Processing queued actions...');
            
            if (offlineQueue.queueLength > 0) {
                logger.info(`${offlineQueue.queueLength} actions queued while offline`);
            }
        }
    }, [onlineStatus.wasOffline, onlineStatus.isOnline, offlineQueue.queueLength]);

    return {
        ...onlineStatus,
        ...offlineQueue,
    };
};
