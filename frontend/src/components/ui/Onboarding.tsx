/**
 * Onboarding Component - Guided onboarding flow for new users
 *
 * A comprehensive onboarding system featuring:
 * - Step-by-step guided tour with spotlight highlighting
 * - Customizable step configurations
 * - Progress tracking with persistence
 * - Keyboard navigation support
 * - Skip and resume functionality
 * - Full accessibility support
 *
 * @example
 * <OnboardingProvider>
 *   <App />
 * </OnboardingProvider>
 *
 * @example
 * const { startOnboarding, isOnboardingActive } = useOnboarding();
 * <button onClick={() => startOnboarding()}>Start Tour</button>
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import './Onboarding.css';

// ============================================
// Types and Interfaces
// ============================================

export type OnboardingStepPosition =
  | 'top'
  | 'bottom'
  | 'left'
  | 'right'
  | 'top-left'
  | 'top-right'
  | 'bottom-left'
  | 'bottom-right'
  | 'center';

export interface OnboardingStep {
  /** Unique identifier for the step */
  id: string;
  /** CSS selector for the target element to highlight */
  target?: string;
  /** Title of the step */
  title: string;
  /** Description/content of the step */
  content: React.ReactNode;
  /** Position of the tooltip relative to target */
  position?: OnboardingStepPosition;
  /** Action to perform when step is shown */
  onShow?: () => void;
  /** Action to perform when step is hidden */
  onHide?: () => void;
  /** Whether to disable interaction with the target */
  disableInteraction?: boolean;
  /** Custom action button text (default: "Next") */
  actionText?: string;
  /** Whether this step can be skipped */
  canSkip?: boolean;
  /** Delay before showing this step (ms) */
  delay?: number;
}

export interface OnboardingConfig {
  /** Unique identifier for this onboarding flow */
  id: string;
  /** Steps in the onboarding flow */
  steps: OnboardingStep[];
  /** Whether to show progress indicator */
  showProgress?: boolean;
  /** Whether to allow skipping the entire onboarding */
  allowSkip?: boolean;
  /** Callback when onboarding is completed */
  onComplete?: () => void;
  /** Callback when onboarding is skipped */
  onSkip?: () => void;
  /** Storage key for persistence */
  storageKey?: string;
}

export interface OnboardingContextValue {
  /** Whether onboarding is currently active */
  isActive: boolean;
  /** Current step index */
  currentStep: number;
  /** Current step configuration */
  currentStepConfig: OnboardingStep | null;
  /** Total number of steps */
  totalSteps: number;
  /** Start the onboarding flow */
  startOnboarding: (config?: OnboardingConfig) => void;
  /** Go to the next step */
  nextStep: () => void;
  /** Go to the previous step */
  prevStep: () => void;
  /** Skip the entire onboarding */
  skipOnboarding: () => void;
  /** End the onboarding flow */
  endOnboarding: () => void;
  /** Go to a specific step */
  goToStep: (stepIndex: number) => void;
  /** Check if a specific onboarding has been completed */
  hasCompletedOnboarding: (id: string) => boolean;
  /** Reset completion status for an onboarding */
  resetOnboarding: (id: string) => void;
}

// ============================================
// Default Configuration
// ============================================

const DEFAULT_STEPS: OnboardingStep[] = [
  {
    id: 'welcome',
    title: 'Welcome to Fringe Core!',
    content: (
      <>
        <p>Your command center for managing Star Citizen organizations, fleets, and operations.</p>
        <p>Let&apos;s take a quick tour to get you started.</p>
      </>
    ),
    position: 'center',
  },
  {
    id: 'dashboard',
    target: '[data-onboarding="dashboard"]',
    title: 'Your Dashboard',
    content:
      'This is your central hub. View key metrics, quick actions, and live activity at a glance.',
    position: 'bottom',
  },
  {
    id: 'fleet',
    target: '[data-onboarding="fleet-nav"]',
    title: 'Fleet Management',
    content: "Manage your organization's ships, squadrons, and fleet composition here.",
    position: 'right',
  },
  {
    id: 'trading',
    target: '[data-onboarding="trading-nav"]',
    title: 'Trading & Routes',
    content: 'Plan profitable trading routes, track commodity prices, and optimize your logistics.',
    position: 'right',
  },
  {
    id: 'notifications',
    target: '[data-onboarding="notifications"]',
    title: 'Stay Updated',
    content:
      'Real-time notifications keep you informed about fleet activities, trading opportunities, and more.',
    position: 'bottom-left',
  },
  {
    id: 'complete',
    title: "You're All Set!",
    content: (
      <>
        <p>You now know the basics of Fringe Core.</p>
        <p>Explore the features and build your organization&apos;s success!</p>
      </>
    ),
    position: 'center',
    actionText: 'Get Started',
  },
];

export const DEFAULT_ONBOARDING_CONFIG: OnboardingConfig = {
  id: 'main-onboarding',
  steps: DEFAULT_STEPS,
  showProgress: true,
  allowSkip: true,
  storageKey: 'scfm-onboarding-status',
};

// ============================================
// Context
// ============================================

const OnboardingContext = createContext<OnboardingContextValue | null>(null);

// ============================================
// Spotlight Component
// ============================================

interface SpotlightProps {
  targetElement: Element | null;
  isVisible: boolean;
}

function Spotlight({ targetElement, isVisible }: SpotlightProps): React.ReactElement | null {
  const [rect, setRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    if (targetElement && isVisible) {
      const updateRect = () => {
        setRect(targetElement.getBoundingClientRect());
      };
      updateRect();

      // Update on scroll/resize
      window.addEventListener('scroll', updateRect, true);
      window.addEventListener('resize', updateRect);

      return () => {
        window.removeEventListener('scroll', updateRect, true);
        window.removeEventListener('resize', updateRect);
      };
    } else {
      setRect(null);
    }
  }, [targetElement, isVisible]);

  if (!isVisible || !rect) return null;

  const padding = 8;

  return (
    <div className="onboarding-spotlight" aria-hidden="true">
      <svg className="onboarding-spotlight__svg" width="100%" height="100%">
        <defs>
          <mask id="spotlight-mask">
            <rect width="100%" height="100%" fill="white" />
            <rect
              x={rect.left - padding}
              y={rect.top - padding}
              width={rect.width + padding * 2}
              height={rect.height + padding * 2}
              rx="8"
              fill="black"
            />
          </mask>
        </defs>
        <rect width="100%" height="100%" fill="rgba(0, 0, 0, 0.75)" mask="url(#spotlight-mask)" />
      </svg>
      <div
        className="onboarding-spotlight__highlight"
        style={{
          left: rect.left - padding,
          top: rect.top - padding,
          width: rect.width + padding * 2,
          height: rect.height + padding * 2,
        }}
      />
    </div>
  );
}

// ============================================
// Tooltip Component
// ============================================

interface OnboardingTooltipProps {
  step: OnboardingStep;
  targetElement: Element | null;
  stepIndex: number;
  totalSteps: number;
  showProgress: boolean;
  allowSkip: boolean;
  onNext: () => void;
  onPrev: () => void;
  onSkip: () => void;
  isFirstStep: boolean;
  isLastStep: boolean;
}

function OnboardingTooltip({
  step,
  targetElement,
  stepIndex,
  totalSteps,
  showProgress,
  allowSkip,
  onNext,
  onPrev,
  onSkip,
  isFirstStep,
  isLastStep,
}: OnboardingTooltipProps): React.ReactElement {
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ top: 0, left: 0 });

  const calculatePosition = useCallback(() => {
    if (!tooltipRef.current) return;

    const tooltipRect = tooltipRef.current.getBoundingClientRect();
    const stepPosition = step.position || 'bottom';

    if (!targetElement || stepPosition === 'center') {
      // Center in viewport
      setPosition({
        top: (window.innerHeight - tooltipRect.height) / 2,
        left: (window.innerWidth - tooltipRect.width) / 2,
      });
      return;
    }

    const targetRect = targetElement.getBoundingClientRect();
    const gap = 16;

    let top = 0;
    let left = 0;

    switch (stepPosition) {
      case 'top':
        top = targetRect.top - tooltipRect.height - gap;
        left = targetRect.left + (targetRect.width - tooltipRect.width) / 2;
        break;
      case 'bottom':
        top = targetRect.bottom + gap;
        left = targetRect.left + (targetRect.width - tooltipRect.width) / 2;
        break;
      case 'left':
        top = targetRect.top + (targetRect.height - tooltipRect.height) / 2;
        left = targetRect.left - tooltipRect.width - gap;
        break;
      case 'right':
        top = targetRect.top + (targetRect.height - tooltipRect.height) / 2;
        left = targetRect.right + gap;
        break;
      case 'top-left':
        top = targetRect.top - tooltipRect.height - gap;
        left = targetRect.left;
        break;
      case 'top-right':
        top = targetRect.top - tooltipRect.height - gap;
        left = targetRect.right - tooltipRect.width;
        break;
      case 'bottom-left':
        top = targetRect.bottom + gap;
        left = targetRect.left;
        break;
      case 'bottom-right':
        top = targetRect.bottom + gap;
        left = targetRect.right - tooltipRect.width;
        break;
      default:
        top = targetRect.bottom + gap;
        left = targetRect.left + (targetRect.width - tooltipRect.width) / 2;
    }

    // Keep within viewport bounds
    const padding = 16;
    top = Math.max(padding, Math.min(window.innerHeight - tooltipRect.height - padding, top));
    left = Math.max(padding, Math.min(window.innerWidth - tooltipRect.width - padding, left));

    setPosition({ top, left });
  }, [targetElement, step.position]);

  useEffect(() => {
    calculatePosition();

    window.addEventListener('scroll', calculatePosition, true);
    window.addEventListener('resize', calculatePosition);

    return () => {
      window.removeEventListener('scroll', calculatePosition, true);
      window.removeEventListener('resize', calculatePosition);
    };
  }, [calculatePosition]);

  // Scroll target into view
  useEffect(() => {
    if (targetElement) {
      targetElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [targetElement]);

  // Focus management
  useEffect(() => {
    tooltipRef.current?.focus();
  }, [stepIndex]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'Escape':
        onSkip();
        break;
      case 'ArrowRight':
      case 'Enter':
        onNext();
        break;
      case 'ArrowLeft':
        if (!isFirstStep) onPrev();
        break;
    }
  };

  const isCentered = step.position === 'center' || !targetElement;

  return (
    <div
      ref={tooltipRef}
      className={`onboarding-tooltip ${isCentered ? 'onboarding-tooltip--centered' : ''}`}
      style={{ top: position.top, left: position.left }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="onboarding-title"
      tabIndex={-1}
      onKeyDown={handleKeyDown}
      data-testid="onboarding-tooltip"
    >
      <div className="onboarding-tooltip__backdrop" aria-hidden="true" />
      <div className="onboarding-tooltip__content">
        <h2 id="onboarding-title" className="onboarding-tooltip__title">
          {step.title}
        </h2>
        <div className="onboarding-tooltip__body">{step.content}</div>

        {showProgress && (
          <div
            className="onboarding-tooltip__progress"
            aria-label={`Step ${stepIndex + 1} of ${totalSteps}`}
          >
            {Array.from({ length: totalSteps }, (_, i) => (
              <span
                key={i}
                className={`onboarding-tooltip__progress-dot ${i === stepIndex ? 'onboarding-tooltip__progress-dot--active' : ''} ${i < stepIndex ? 'onboarding-tooltip__progress-dot--completed' : ''}`}
                aria-hidden="true"
              />
            ))}
          </div>
        )}

        <div className="onboarding-tooltip__actions">
          {allowSkip && !isLastStep && (
            <button
              type="button"
              className="onboarding-tooltip__button onboarding-tooltip__button--skip"
              onClick={onSkip}
            >
              Skip Tour
            </button>
          )}

          <div className="onboarding-tooltip__nav">
            {!isFirstStep && (
              <button
                type="button"
                className="onboarding-tooltip__button onboarding-tooltip__button--secondary"
                onClick={onPrev}
              >
                Previous
              </button>
            )}
            <button
              type="button"
              className="onboarding-tooltip__button onboarding-tooltip__button--primary"
              onClick={onNext}
            >
              {step.actionText || (isLastStep ? 'Finish' : 'Next')}
            </button>
          </div>
        </div>
      </div>
      <div className="onboarding-tooltip__glow" aria-hidden="true" />
    </div>
  );
}

// ============================================
// Provider Component
// ============================================

export interface OnboardingProviderProps {
  children: React.ReactNode;
  /** Default configuration for onboarding */
  defaultConfig?: OnboardingConfig;
  /** Whether to auto-start onboarding for new users */
  autoStart?: boolean;
}

export function OnboardingProvider({
  children,
  defaultConfig = DEFAULT_ONBOARDING_CONFIG,
  autoStart = false,
}: OnboardingProviderProps): React.ReactElement {
  const [isActive, setIsActive] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [config, setConfig] = useState<OnboardingConfig>(defaultConfig);
  const [targetElement, setTargetElement] = useState<Element | null>(null);

  const storageKey = config.storageKey || 'scfm-onboarding-status';

  // Check if onboarding has been completed
  const hasCompletedOnboarding = useCallback(
    (id: string): boolean => {
      try {
        const stored = localStorage.getItem(storageKey);
        if (!stored) return false;
        const status = JSON.parse(stored);
        return status[id] === 'completed';
      } catch {
        return false;
      }
    },
    [storageKey]
  );

  // Mark onboarding as completed
  const markOnboardingCompleted = useCallback(
    (id: string) => {
      try {
        const stored = localStorage.getItem(storageKey);
        const status = stored ? JSON.parse(stored) : {};
        status[id] = 'completed';
        localStorage.setItem(storageKey, JSON.stringify(status));
      } catch {
        // Ignore storage errors
      }
    },
    [storageKey]
  );

  // Reset onboarding status
  const resetOnboarding = useCallback(
    (id: string) => {
      try {
        const stored = localStorage.getItem(storageKey);
        if (stored) {
          const status = JSON.parse(stored);
          delete status[id];
          localStorage.setItem(storageKey, JSON.stringify(status));
        }
      } catch {
        // Ignore storage errors
      }
    },
    [storageKey]
  );

  // Update target element when step changes
  useEffect(() => {
    if (!isActive || !config.steps[currentStep]) {
      setTargetElement(null);
      return;
    }

    const step = config.steps[currentStep];
    if (step.target) {
      // Use delay if specified
      const delay = step.delay || 0;
      const timer = setTimeout(() => {
        const element = document.querySelector(step.target as string);
        setTargetElement(element);
      }, delay);
      return () => clearTimeout(timer);
    } else {
      setTargetElement(null);
    }
  }, [isActive, currentStep, config.steps]);

  // Call step callbacks
  useEffect(() => {
    if (!isActive) return;

    const step = config.steps[currentStep];
    if (step?.onShow) {
      step.onShow();
    }

    return () => {
      if (step?.onHide) {
        step.onHide();
      }
    };
  }, [isActive, currentStep, config.steps]);

  // Auto-start logic
  useEffect(() => {
    if (autoStart && !hasCompletedOnboarding(config.id)) {
      // Delay auto-start to allow page to render
      const timer = setTimeout(() => {
        setIsActive(true);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [autoStart, config.id, hasCompletedOnboarding]);

  const startOnboarding = useCallback((newConfig?: OnboardingConfig) => {
    if (newConfig) {
      setConfig(newConfig);
    }
    setCurrentStep(0);
    setIsActive(true);
  }, []);

  const endOnboarding = useCallback(() => {
    setIsActive(false);
    setCurrentStep(0);
    setTargetElement(null);
    markOnboardingCompleted(config.id);
    config.onComplete?.();
  }, [config, markOnboardingCompleted]);

  const skipOnboarding = useCallback(() => {
    setIsActive(false);
    setCurrentStep(0);
    setTargetElement(null);
    markOnboardingCompleted(config.id);
    config.onSkip?.();
  }, [config, markOnboardingCompleted]);

  const nextStep = useCallback(() => {
    if (currentStep >= config.steps.length - 1) {
      endOnboarding();
    } else {
      setCurrentStep(prev => prev + 1);
    }
  }, [currentStep, config.steps.length, endOnboarding]);

  const prevStep = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  }, [currentStep]);

  const goToStep = useCallback(
    (stepIndex: number) => {
      if (stepIndex >= 0 && stepIndex < config.steps.length) {
        setCurrentStep(stepIndex);
      }
    },
    [config.steps.length]
  );

  const currentStepConfig = useMemo(() => {
    return config.steps[currentStep] || null;
  }, [config.steps, currentStep]);

  const contextValue = useMemo<OnboardingContextValue>(
    () => ({
      isActive,
      currentStep,
      currentStepConfig,
      totalSteps: config.steps.length,
      startOnboarding,
      nextStep,
      prevStep,
      skipOnboarding,
      endOnboarding,
      goToStep,
      hasCompletedOnboarding,
      resetOnboarding,
    }),
    [
      isActive,
      currentStep,
      currentStepConfig,
      config.steps.length,
      startOnboarding,
      nextStep,
      prevStep,
      skipOnboarding,
      endOnboarding,
      goToStep,
      hasCompletedOnboarding,
      resetOnboarding,
    ]
  );

  return (
    <OnboardingContext.Provider value={contextValue}>
      {children}
      {isActive && currentStepConfig && (
        <>
          <Spotlight targetElement={targetElement} isVisible={!!currentStepConfig.target} />
          <OnboardingTooltip
            step={currentStepConfig}
            targetElement={targetElement}
            stepIndex={currentStep}
            totalSteps={config.steps.length}
            showProgress={config.showProgress ?? true}
            allowSkip={config.allowSkip ?? true}
            onNext={nextStep}
            onPrev={prevStep}
            onSkip={skipOnboarding}
            isFirstStep={currentStep === 0}
            isLastStep={currentStep === config.steps.length - 1}
          />
        </>
      )}
    </OnboardingContext.Provider>
  );
}

// ============================================
// Hook
// ============================================

export function useOnboarding(): OnboardingContextValue {
  const context = useContext(OnboardingContext);
  if (!context) {
    throw new Error('useOnboarding must be used within an OnboardingProvider');
  }
  return context;
}
