import { logger } from '@/utils/logger';
import { Metric, onCLS, onINP, onLCP, onTTFB } from 'web-vitals';
import { apiClient } from './apiClient';

/**
 * Performance Monitoring Service
 *
 * Tracks Core Web Vitals and sends metrics to the backend for analysis:
 * - LCP (Largest Contentful Paint): Loading performance
 * - INP (Interaction to Next Paint): Responsiveness (replaced FID in web-vitals v3+)
 * - CLS (Cumulative Layout Shift): Visual stability
 * - TTFB (Time to First Byte): Server response time
 */

/**
 * Web Vitals metric payload sent to backend
 */
export interface WebVitalsMetric {
  name: string;
  value: number;
  rating: 'good' | 'needs-improvement' | 'poor';
  delta: number;
  id: string;
  navigationType: string;
  timestamp: number;
  url: string;
  userAgent: string;
}

/**
 * Performance budget thresholds (in milliseconds or score)
 * Based on Google's Core Web Vitals recommendations
 */
export const PERFORMANCE_BUDGETS = {
  LCP: {
    good: 2500, // < 2.5s = good
    poor: 4000, // > 4.0s = poor
  },
  INP: {
    good: 200, // < 200ms = good
    poor: 500, // > 500ms = poor
  },
  CLS: {
    good: 0.1, // < 0.1 = good
    poor: 0.25, // > 0.25 = poor
  },
  TTFB: {
    good: 800, // < 800ms = good
    poor: 1800, // > 1800ms = poor
  },
};

/**
 * Performance Monitoring Service
 */
export class PerformanceMonitoringService {
  private static instance: PerformanceMonitoringService;
  private isInitialized = false;
  private metricsQueue: WebVitalsMetric[] = [];
  private maxQueueSize = 50;
  private batchSendInterval = 30000; // Send batch every 30 seconds
  private batchSendTimer?: ReturnType<typeof setInterval>;

  private constructor() {}

  /**
   * Get singleton instance
   */
  public static getInstance(): PerformanceMonitoringService {
    if (!PerformanceMonitoringService.instance) {
      PerformanceMonitoringService.instance = new PerformanceMonitoringService();
    }
    return PerformanceMonitoringService.instance;
  }

  /**
   * Initialize performance monitoring and start tracking Web Vitals
   */
  public initialize(): void {
    if (this.isInitialized) {
      if (import.meta.env.DEV) {
        logger.warn('PerformanceMonitoringService already initialized');
      }
      return;
    }

    // Only track in browser environment
    if (typeof window === 'undefined') {
      return;
    }

    this.setupWebVitalsTracking();
    this.startBatchSending();
    this.isInitialized = true;

    if (import.meta.env.DEV) {
      logger.info('PerformanceMonitoringService initialized successfully');
    }
  }

  /**
   * Set up Web Vitals tracking
   */
  private setupWebVitalsTracking(): void {
    // Track Largest Contentful Paint (LCP)
    onLCP(metric => this.handleMetric(metric), { reportAllChanges: false });

    // Track Interaction to Next Paint (INP) - replacement for FID
    onINP(metric => this.handleMetric(metric), { reportAllChanges: false });

    // Track Cumulative Layout Shift (CLS)
    onCLS(metric => this.handleMetric(metric), { reportAllChanges: false });

    // Track Time to First Byte (TTFB)
    onTTFB(metric => this.handleMetric(metric), { reportAllChanges: false });
  }

  /**
   * Handle a Web Vitals metric
   */
  private handleMetric(metric: Metric): void {
    const webVitalsMetric: WebVitalsMetric = {
      name: metric.name,
      value: metric.value,
      rating: metric.rating,
      delta: metric.delta,
      id: metric.id,
      navigationType: metric.navigationType,
      timestamp: Date.now(),
      url: window.location.href,
      userAgent: navigator.userAgent,
    };

    // Log in development
    if (import.meta.env.DEV) {
      const emoji =
        metric.rating === 'good' ? '✅' : metric.rating === 'needs-improvement' ? '⚠️' : '❌';
      logger.info(`${emoji} Web Vitals - ${metric.name}`, {
        value: this.formatMetricValue(metric.name, metric.value),
        rating: metric.rating,
        delta: metric.delta,
      });
    }

    // Add to queue
    this.addToQueue(webVitalsMetric);
  }

  /**
   * Format metric value for display
   */
  private formatMetricValue(name: string, value: number): string {
    if (name === 'CLS') {
      return value.toFixed(3);
    }
    return `${Math.round(value)}ms`;
  }

  /**
   * Add metric to queue
   */
  private addToQueue(metric: WebVitalsMetric): void {
    this.metricsQueue.push(metric);

    // Keep queue size under limit
    if (this.metricsQueue.length > this.maxQueueSize) {
      this.metricsQueue.shift();
    }

    // Send immediately if queue is getting full
    if (this.metricsQueue.length >= this.maxQueueSize * 0.8) {
      this.sendMetricsBatch();
    }
  }

  /**
   * Start batch sending timer
   */
  private startBatchSending(): void {
    this.batchSendTimer = setInterval(() => {
      if (this.metricsQueue.length > 0) {
        this.sendMetricsBatch();
      }
    }, this.batchSendInterval);
  }

  /**
   * Send metrics batch to backend
   * Uses apiClient which automatically injects CSRF token, credentials, and baseURL.
   */
  private async sendMetricsBatch(): Promise<void> {
    if (this.metricsQueue.length === 0) {
      return;
    }

    const metricsToSend = [...this.metricsQueue];
    this.metricsQueue = [];

    try {
      await apiClient.postRaw('/api/v2/metrics/web-vitals', { metrics: metricsToSend });

      if (import.meta.env.DEV) {
        logger.info(`Successfully sent ${metricsToSend.length} Web Vitals metrics to backend`);
      }
    } catch (error) {
      // Put metrics back in queue on error, respecting max queue size
      const remainingSpace = this.maxQueueSize - this.metricsQueue.length;
      if (remainingSpace > 0) {
        this.metricsQueue.unshift(...metricsToSend.slice(-remainingSpace));
      }

      if (import.meta.env.DEV) {
        logger.warn('Failed to send Web Vitals metrics to backend:', error);
      }
    }
  }

  /**
   * Get current metrics rating for a specific metric
   */
  public getMetricRating(name: string, value: number): 'good' | 'needs-improvement' | 'poor' {
    const budget = PERFORMANCE_BUDGETS[name as keyof typeof PERFORMANCE_BUDGETS];
    if (!budget) {
      return 'good';
    }

    if (value <= budget.good) {
      return 'good';
    } else if (value <= budget.poor) {
      return 'needs-improvement';
    } else {
      return 'poor';
    }
  }

  /**
   * Get queued metrics (for debugging)
   */
  public getQueuedMetrics(): WebVitalsMetric[] {
    return [...this.metricsQueue];
  }

  /**
   * Force send all queued metrics immediately
   */
  public async flush(): Promise<void> {
    await this.sendMetricsBatch();
  }

  /**
   * Clean up resources
   */
  public destroy(): void {
    if (this.batchSendTimer) {
      clearInterval(this.batchSendTimer);
      this.batchSendTimer = undefined;
    }
    this.isInitialized = false;
  }
}

// Export singleton instance
export const performanceMonitoringService = PerformanceMonitoringService.getInstance();
