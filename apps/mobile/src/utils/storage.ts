/**
 * AsyncStorage wrapper for Zustand persist middleware.
 * Replaces localStorage for React Native.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import type { StateStorage } from 'zustand/middleware';

/**
 * Zustand-compatible StateStorage backed by AsyncStorage.
 * Note: Zustand persist middleware handles async storage natively via
 * createJSONStorage, so getItem/setItem/removeItem must return Promise<string | null>.
 */
export const asyncStorage: StateStorage = {
  getItem: async (name: string): Promise<string | null> => {
    return AsyncStorage.getItem(name);
  },
  setItem: async (name: string, value: string): Promise<void> => {
    await AsyncStorage.setItem(name, value);
  },
  removeItem: async (name: string): Promise<void> => {
    await AsyncStorage.removeItem(name);
  },
};

/**
 * Get a stored value by key.
 */
export async function getStoredValue(key: string): Promise<string | null> {
  return AsyncStorage.getItem(key);
}

/**
 * Set a value by key.
 */
export async function setStoredValue(key: string, value: string): Promise<void> {
  await AsyncStorage.setItem(key, value);
}

/**
 * Remove a value by key.
 */
export async function removeStoredValue(key: string): Promise<void> {
  await AsyncStorage.removeItem(key);
}

/**
 * Clear all stored values. Use with caution.
 */
export async function clearStorage(): Promise<void> {
  await AsyncStorage.clear();
}
