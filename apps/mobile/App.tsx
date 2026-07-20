import { QueryClientProvider } from '@tanstack/react-query';
import React, { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { queryClient } from './src/hooks/queries/queryClient';
import { RootNavigator } from './src/navigation/RootNavigator';
import { initializeApiClient } from './src/services/apiClient';
import { useAuthStore } from './src/store/authStore';
import { logger } from './src/utils/logger';

export default function App() {
  useEffect(() => {
    const initAuth = async () => {
      try {
        await initializeApiClient();
        const { checkAuth } = useAuthStore.getState();
        checkAuth();
      } catch (error) {
        logger.error(
          'Failed to initialize API client',
          error instanceof Error ? error : new Error(String(error))
        );
      }
    };
    initAuth();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider>
        <RootNavigator />
      </SafeAreaProvider>
    </QueryClientProvider>
  );
}
