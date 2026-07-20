/**
 * React Hook for Backend Health Checking
 * Provides easy integration of backend health checks in React components
 */

import { useEffect, useState, useCallback } from 'react';
import { checkBackendHealth, monitorBackendHealth, HealthCheckResult } from '@/services/healthService';

/**
 * Hook for checking backend health on demand
 * 
 * @returns Object with health status, check function, and loading state
 */
export function useBackendHealth() {
  const [health, setHealth] = useState<HealthCheckResult | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  
  const check = useCallback(async () => {
    setIsChecking(true);
    try {
      const result = await checkBackendHealth();
      setHealth(result);
      return result;
    } finally {
      setIsChecking(false);
    }
  }, []);
  
  return {
    health,
    isChecking,
    check,
    isHealthy: health?.isHealthy ?? null,
  };
}

/**
 * Hook for monitoring backend health continuously
 * Automatically checks health on mount and at regular intervals
 * 
 * @param options - Configuration options
 * @param options.enabled - Whether monitoring is enabled (default: true)
 * @param options.intervalMs - Check interval in milliseconds (default: 30000)
 * @param options.onHealthChange - Optional callback when health changes
 * @returns Object with current health status
 * 
 * Note: If using onHealthChange callback, wrap it in useCallback to prevent
 * unnecessary monitoring restarts when the component re-renders.
 */
export function useBackendHealthMonitor(options?: {
  enabled?: boolean;
  intervalMs?: number;
  onHealthChange?: (result: HealthCheckResult) => void;
}) {
  const { enabled = true, intervalMs = 30000, onHealthChange } = options || {};
  const [health, setHealth] = useState<HealthCheckResult | null>(null);
  
  useEffect(() => {
    if (!enabled) {
      return;
    }
    
    const handleHealthChange = (result: HealthCheckResult) => {
      setHealth(result);
      if (onHealthChange) {
        onHealthChange(result);
      }
    };
    
    const stopMonitoring = monitorBackendHealth(handleHealthChange, intervalMs);
    
    return () => {
      stopMonitoring();
    };
    // Intentionally excluding onHealthChange from dependencies to avoid restart on every render
    // Users should wrap onHealthChange in useCallback if they want stable reference
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, intervalMs]);
  
  return {
    health,
    isHealthy: health?.isHealthy ?? null,
    backendUrl: health?.backendUrl,
    error: health?.error,
  };
}

/**
 * Hook that checks backend health once on component mount
 * Useful for initialization checks
 * 
 * @returns Object with health status and loading state
 */
export function useBackendHealthCheck() {
  const [health, setHealth] = useState<HealthCheckResult | null>(null);
  const [isChecking, setIsChecking] = useState(true);
  
  useEffect(() => {
    let mounted = true;
    
    const check = async () => {
      setIsChecking(true);
      try {
        const result = await checkBackendHealth();
        if (mounted) {
          setHealth(result);
        }
      } finally {
        if (mounted) {
          setIsChecking(false);
        }
      }
    };
    
    check();
    
    return () => {
      mounted = false;
    };
  }, []);
  
  return {
    health,
    isChecking,
    isHealthy: health?.isHealthy ?? null,
  };
}
