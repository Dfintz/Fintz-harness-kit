/**
 * Guide Mode — presenter-driven, multi-page product tour engine.
 *
 * Unlike the single-page onboarding flow, Guide Mode can navigate between routes
 * as it advances, spotlight a target element on each page, and show talking
 * points. It is designed to be reliable for live demos:
 *
 * - Route-aware: a step may declare a `route`; the engine navigates there first.
 * - Resilient targeting: it polls for the step's target after navigation and
 *   gracefully falls back to a centered card if the element never appears.
 * - Keyboard-first: ← / → (or Enter) to move, Esc to exit. Shift + ? starts it.
 *
 * Mount <GuideModeProvider> inside the router (it uses useNavigate). Anything
 * rendered beneath it can start the tour via useGuideMode().start().
 */

import { routePathMatchesLocation } from '@/components/navigation/routeMatcher';
import { FocusTrap } from '@/components/ui/accessibility/FocusTrap';
import { ENABLE_LIVE_DEMO_GUIDE } from '@/config/env';
import { useAuthStore } from '@/store/authStore';
import {
  clearGuideAutostartParam,
  getGuideNewUserDismissedStorageKey,
  GUIDE_AUTOSTART_SESSION_KEY,
  isGuideAutostartRequested,
  ONBOARDING_COMPLETED_KEY,
} from '@/utils/guideAutostart';
import { isTypingContextTarget } from '@/utils/keyboardTarget';
import { sanitizeInternalPath } from '@/utils/urlSafety';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import CloseIcon from '@mui/icons-material/Close';
import { Box, Button, Paper, Stack, Typography } from '@mui/material';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { DEFAULT_GUIDE_SCRIPT, GuidePlacement, GuideScript, GuideStep } from './guideScript';

const TARGET_RESOLVE_TIMEOUT_MS = 4000;
const TARGET_POLL_INTERVAL_MS = 120;
const SPOTLIGHT_PADDING = 8;
const CARD_GAP = 16;
const CARD_WIDTH = 380;

interface RouteMatchInput {
  pathname: string;
  search: string;
}

export function doesCurrentLocationMatchStepRoute(
  route: string,
  current: RouteMatchInput
): boolean {
  return routePathMatchesLocation(route, current, {
    allowPrefixMatch: false,
  });
}

// ============================================================================
// Context
// ============================================================================

export interface GuideModeContextValue {
  /** Whether the tour is currently running. */
  isActive: boolean;
  /** Index of the current step. */
  index: number;
  /** Total number of steps in the active script. */
  total: number;
  /** The current step, or null when inactive. */
  step: GuideStep | null;
  /** Start the tour (optionally with a custom script). */
  start: (script?: GuideScript) => void;
  /** Exit the tour. */
  exit: () => void;
  /** Advance to the next step (finishes on the last step). */
  next: () => void;
  /** Go back to the previous step. */
  prev: () => void;
}

const GuideModeContext = createContext<GuideModeContextValue | null>(null);

/** Access Guide Mode. Throws if used outside <GuideModeProvider>. */
export function useGuideMode(): GuideModeContextValue {
  const ctx = useContext(GuideModeContext);
  if (!ctx) {
    throw new Error('useGuideMode must be used within a GuideModeProvider');
  }
  return ctx;
}

/** Access Guide Mode without throwing — returns null outside the provider. */
export function useOptionalGuideMode(): GuideModeContextValue | null {
  return useContext(GuideModeContext);
}

// ============================================================================
// Spotlight
// ============================================================================

interface SpotlightProps {
  rect: DOMRect | null;
}

function Spotlight({ rect }: Readonly<SpotlightProps>): React.ReactElement {
  // No target → a plain dimming scrim.
  if (!rect) {
    return (
      <Box
        aria-hidden="true"
        sx={{ position: 'fixed', inset: 0, bgcolor: 'rgba(5, 10, 18, 0.72)' }}
      />
    );
  }

  const x = rect.left - SPOTLIGHT_PADDING;
  const y = rect.top - SPOTLIGHT_PADDING;
  const w = rect.width + SPOTLIGHT_PADDING * 2;
  const h = rect.height + SPOTLIGHT_PADDING * 2;

  return (
    <Box aria-hidden="true" sx={{ position: 'fixed', inset: 0 }}>
      <Box component="svg" width="100%" height="100%" sx={{ position: 'absolute', inset: 0 }}>
        <defs>
          <mask id="guide-spotlight-mask">
            <rect width="100%" height="100%" fill="white" />
            <rect x={x} y={y} width={w} height={h} rx="10" fill="black" />
          </mask>
        </defs>
        <rect
          width="100%"
          height="100%"
          fill="rgba(5, 10, 18, 0.72)"
          mask="url(#guide-spotlight-mask)"
        />
      </Box>
      <Box
        sx={{
          position: 'fixed',
          left: x,
          top: y,
          width: w,
          height: h,
          borderRadius: '10px',
          border: '2px solid',
          borderColor: 'primary.main',
          boxShadow: '0 0 0 4px rgba(0, 217, 255, 0.25)',
          pointerEvents: 'none',
        }}
      />
    </Box>
  );
}

// ============================================================================
// Card placement
// ============================================================================

function computeCardPosition(
  rect: DOMRect | null,
  placement: GuidePlacement,
  cardRect: { width: number; height: number }
): { top: number; left: number } {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const margin = 16;

  if (!rect || placement === 'center') {
    return {
      top: Math.max(margin, (vh - cardRect.height) / 2),
      left: Math.max(margin, (vw - cardRect.width) / 2),
    };
  }

  let top = 0;
  let left = 0;
  switch (placement) {
    case 'top':
      top = rect.top - cardRect.height - CARD_GAP;
      left = rect.left + (rect.width - cardRect.width) / 2;
      break;
    case 'left':
      top = rect.top + (rect.height - cardRect.height) / 2;
      left = rect.left - cardRect.width - CARD_GAP;
      break;
    case 'right':
      top = rect.top + (rect.height - cardRect.height) / 2;
      left = rect.right + CARD_GAP;
      break;
    case 'bottom':
    default:
      top = rect.bottom + CARD_GAP;
      left = rect.left + (rect.width - cardRect.width) / 2;
      break;
  }

  // Clamp into the viewport.
  top = Math.max(margin, Math.min(vh - cardRect.height - margin, top));
  left = Math.max(margin, Math.min(vw - cardRect.width - margin, left));
  return { top, left };
}

// ============================================================================
// Card
// ============================================================================

interface GuideCardProps {
  step: GuideStep;
  rect: DOMRect | null;
  index: number;
  total: number;
  showSkip: boolean;
  onSkip: () => void;
  onNext: () => void;
  onPrev: () => void;
  onExit: () => void;
}

function GuideCard({
  step,
  rect,
  index,
  total,
  showSkip,
  onSkip,
  onNext,
  onPrev,
  onExit,
}: Readonly<GuideCardProps>): React.ReactElement {
  const cardRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number }>({ top: -9999, left: -9999 });
  const placement = step.placement ?? 'bottom';
  const isFirst = index === 0;
  const isLast = index === total - 1;

  const reposition = useCallback(() => {
    const el = cardRef.current;
    if (!el) return;
    const cardRect = el.getBoundingClientRect();
    setPos(computeCardPosition(rect, placement, cardRect));
  }, [rect, placement]);

  // Reposition on mount, target change, and viewport changes.
  useEffect(() => {
    reposition();
    window.addEventListener('resize', reposition);
    window.addEventListener('scroll', reposition, true);
    return () => {
      window.removeEventListener('resize', reposition);
      window.removeEventListener('scroll', reposition, true);
    };
  }, [reposition]);

  // Move focus to the card when the step changes (accessibility).
  useEffect(() => {
    cardRef.current?.focus();
  }, [index]);

  return (
    <FocusTrap active autoFocus restoreFocus initialFocus={cardRef} onEscapeKey={onExit}>
      <Paper
        ref={cardRef}
        elevation={8}
        role="dialog"
        aria-modal="true"
        aria-labelledby="guide-card-title"
        tabIndex={-1}
        sx={{
          position: 'fixed',
          top: pos.top,
          left: pos.left,
          width: CARD_WIDTH,
          maxWidth: 'calc(100vw - 32px)',
          p: 3,
          borderRadius: 3,
          outline: 'none',
          border: '1px solid',
          borderColor: 'primary.main',
        }}
      >
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
          <Typography variant="overline" sx={{ color: 'primary.main', letterSpacing: '0.08em' }}>
            {step.scene}
          </Typography>
          <Stack direction="row" spacing={1}>
            {showSkip && (
              <Button
                onClick={onSkip}
                size="small"
                variant="text"
                sx={{ color: 'text.secondary', minWidth: 0 }}
                aria-label="Skip guide auto-start"
              >
                Skip Tour
              </Button>
            )}
            <Button
              onClick={onExit}
              size="small"
              startIcon={<CloseIcon fontSize="small" />}
              sx={{ color: 'text.secondary', minWidth: 0 }}
              aria-label="Exit guide"
            >
              Exit
            </Button>
          </Stack>
        </Stack>

        <Typography id="guide-card-title" variant="h5" sx={{ mb: 1 }}>
          {step.title}
        </Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary', mb: step.points ? 1.5 : 2 }}>
          {step.body}
        </Typography>

        {step.points && step.points.length > 0 && (
          <Stack component="ul" spacing={0.75} sx={{ m: 0, mb: 2, pl: 2.5 }}>
            {step.points.map(point => (
              <Typography component="li" variant="body2" key={point}>
                {point}
              </Typography>
            ))}
          </Stack>
        )}

        {/* Progress */}
        <Stack
          direction="row"
          spacing={0.5}
          sx={{ mb: 2 }}
          aria-label={`Step ${index + 1} of ${total}`}
        >
          {Array.from({ length: total }, (_, i) => (
            <Box
              key={i}
              aria-hidden="true"
              sx={{
                flex: 1,
                height: 4,
                borderRadius: 2,
                bgcolor: i <= index ? 'primary.main' : 'action.disabledBackground',
                opacity: i <= index ? 1 : 0.4,
                transition: 'background-color 200ms',
              }}
            />
          ))}
        </Stack>

        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            {index + 1} / {total}
          </Typography>
          <Stack direction="row" spacing={1}>
            <Button
              onClick={onPrev}
              disabled={isFirst}
              size="small"
              variant="outlined"
              startIcon={<ArrowBackIcon fontSize="small" />}
            >
              Back
            </Button>
            <Button
              onClick={onNext}
              size="small"
              variant="contained"
              endIcon={isLast ? undefined : <ArrowForwardIcon fontSize="small" />}
            >
              {isLast ? 'Finish' : 'Next'}
            </Button>
          </Stack>
        </Stack>
      </Paper>
    </FocusTrap>
  );
}

// ============================================================================
// Provider
// ============================================================================

export interface GuideModeProviderProps {
  children: React.ReactNode;
  /** Script used when start() is called without an argument. */
  script?: GuideScript;
}

export function GuideModeProvider({
  children,
  script = DEFAULT_GUIDE_SCRIPT,
}: Readonly<GuideModeProviderProps>): React.ReactElement {
  const user = useAuthStore(state => state.user);
  const navigate = useNavigate();
  const location = useLocation();
  const hasUrlAutoStartedRef = useRef(false);
  const hasEnvAutoStartedRef = useRef(false);
  const hasNewUserAutoStartedRef = useRef(false);

  const [activeScript, setActiveScript] = useState<GuideScript>(script);
  const [isActive, setIsActive] = useState(false);
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [showSkipForAutostart, setShowSkipForAutostart] = useState(false);

  const total = activeScript.steps.length;
  const step = isActive ? (activeScript.steps[index] ?? null) : null;

  const startWithOptions = useCallback((next?: GuideScript, showSkip: boolean = false) => {
    if (next) setActiveScript(next);
    setIndex(0);
    setShowSkipForAutostart(showSkip);
    setIsActive(true);
  }, []);

  const start = useCallback(
    (next?: GuideScript) => {
      startWithOptions(next, false);
    },
    [startWithOptions]
  );

  const exit = useCallback(() => {
    setIsActive(false);
    setIndex(0);
    setRect(null);
    setShowSkipForAutostart(false);
  }, []);

  const markNewUserGuideDismissed = useCallback(() => {
    if (!user?.id) return;

    try {
      globalThis.localStorage.setItem(getGuideNewUserDismissedStorageKey(user.id), 'true');
    } catch {
      // Ignore storage failures (private mode / test environments).
    }
  }, [user?.id]);

  const skipNewUserAutostart = useCallback(() => {
    markNewUserGuideDismissed();
    exit();
  }, [exit, markNewUserGuideDismissed]);

  const next = useCallback(() => {
    setIndex(prev => {
      if (prev >= total - 1) {
        if (showSkipForAutostart) {
          markNewUserGuideDismissed();
        }
        setIsActive(false);
        setRect(null);
        setShowSkipForAutostart(false);
        return 0;
      }
      return prev + 1;
    });
  }, [markNewUserGuideDismissed, showSkipForAutostart, total]);

  const prev = useCallback(() => {
    setIndex(prevIndex => (prevIndex > 0 ? prevIndex - 1 : prevIndex));
  }, []);

  // Allow explicit auto-start via URL in demo flows (e.g., /dashboard?guide=1).
  useEffect(() => {
    if (isActive || hasUrlAutoStartedRef.current) return;
    if (!isGuideAutostartRequested(location.search)) return;

    hasUrlAutoStartedRef.current = true;
    start();
    const safeAutostartPath = sanitizeInternalPath(
      clearGuideAutostartParam(location.pathname, location.search),
      location.pathname
    );
    navigate(safeAutostartPath, { replace: true });
  }, [isActive, location.pathname, location.search, navigate, start]);

  // Optionally auto-start once per session for live-demo deployments.
  useEffect(() => {
    if (isActive || hasEnvAutoStartedRef.current || !ENABLE_LIVE_DEMO_GUIDE) return;

    let alreadyStarted = false;
    try {
      alreadyStarted = globalThis.sessionStorage.getItem(GUIDE_AUTOSTART_SESSION_KEY) === 'true';
    } catch {
      // Ignore storage failures (private mode / test environments).
    }

    if (alreadyStarted) return;

    hasEnvAutoStartedRef.current = true;
    const timer = globalThis.setTimeout(() => {
      start();
      try {
        globalThis.sessionStorage.setItem(GUIDE_AUTOSTART_SESSION_KEY, 'true');
      } catch {
        // Ignore storage failures (private mode / test environments).
      }
    }, 300);
    return () => globalThis.clearTimeout(timer);
  }, [isActive, start]);

  // Auto-start for signed-in users who have not completed onboarding yet.
  useEffect(() => {
    hasNewUserAutoStartedRef.current = false;
  }, [user?.id]);

  useEffect(() => {
    if (isActive || hasNewUserAutoStartedRef.current || !user?.id) return;

    let onboardingCompleted = false;
    let dismissed = false;
    try {
      onboardingCompleted = globalThis.localStorage.getItem(ONBOARDING_COMPLETED_KEY) === 'true';
      dismissed =
        globalThis.localStorage.getItem(getGuideNewUserDismissedStorageKey(user.id)) === 'true';
    } catch {
      // Ignore storage failures (private mode / test environments).
    }

    if (onboardingCompleted || dismissed) return;

    hasNewUserAutoStartedRef.current = true;
    const timer = globalThis.setTimeout(() => {
      startWithOptions(undefined, true);
    }, 300);
    return () => globalThis.clearTimeout(timer);
  }, [isActive, location.pathname, startWithOptions, user?.id]);

  // Navigate to the step's route when needed.
  useEffect(() => {
    if (!isActive || !step?.route) return;
    if (
      !doesCurrentLocationMatchStepRoute(step.route, {
        pathname: location.pathname,
        search: location.search,
      })
    ) {
      navigate(sanitizeInternalPath(step.route, location.pathname));
    }
  }, [isActive, index, step?.route, location.pathname, location.search, navigate]);

  // Resolve (and keep tracking) the spotlight target for the current step.
  useEffect(() => {
    if (!isActive) {
      setRect(null);
      return;
    }
    const current = activeScript.steps[index];
    if (!current?.target) {
      setRect(null);
      return;
    }

    let cancelled = false;
    let pollTimer: ReturnType<typeof setTimeout> | undefined;
    const startedAt = Date.now();

    const resolve = (): void => {
      if (cancelled) return;
      const el = document.querySelector(current.target as string);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setRect(el.getBoundingClientRect());
        return;
      }
      if (Date.now() - startedAt > TARGET_RESOLVE_TIMEOUT_MS) {
        setRect(null); // graceful fallback to a centered card
        return;
      }
      pollTimer = setTimeout(resolve, TARGET_POLL_INTERVAL_MS);
    };

    pollTimer = setTimeout(resolve, current.delay ?? 60);
    return () => {
      cancelled = true;
      if (pollTimer) clearTimeout(pollTimer);
    };
  }, [isActive, index, activeScript.steps, location.pathname, location.search]);

  // Keep the spotlight rect in sync with scroll/resize while a target is shown.
  useEffect(() => {
    if (!isActive || !step?.target) return;
    const update = (): void => {
      const el = document.querySelector(step.target as string);
      if (el) setRect(el.getBoundingClientRect());
    };
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [isActive, index, step?.target]);

  // Global keyboard handling: control the tour when active, launch with Shift+?.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (isActive) {
        if (event.key === 'ArrowRight') {
          event.preventDefault();
          next();
        } else if (event.key === 'Enter') {
          if (!isTypingContextTarget(event.target)) {
            event.preventDefault();
            next();
          }
        } else if (event.key === 'ArrowLeft') {
          event.preventDefault();
          prev();
        }
        return;
      }

      // Launch shortcut: "?" (Shift + /). Ignore when typing in a field.
      if (event.key === '?') {
        const typing = isTypingContextTarget(event.target);
        if (!typing) {
          event.preventDefault();
          start();
        }
      }
    };

    globalThis.addEventListener('keydown', onKeyDown);
    return () => globalThis.removeEventListener('keydown', onKeyDown);
  }, [isActive, next, prev, start]);

  const value = useMemo<GuideModeContextValue>(
    () => ({ isActive, index, total, step, start, exit, next, prev }),
    [isActive, index, total, step, start, exit, next, prev]
  );

  return (
    <GuideModeContext.Provider value={value}>
      {children}
      {isActive && step && (
        <Box
          sx={{ position: 'fixed', inset: 0, zIndex: theme => theme.zIndex.modal + 10 }}
          data-testid="guide-overlay"
        >
          <Spotlight rect={rect} />
          <GuideCard
            step={step}
            rect={rect}
            index={index}
            total={total}
            showSkip={showSkipForAutostart}
            onSkip={skipNewUserAutostart}
            onNext={next}
            onPrev={prev}
            onExit={exit}
          />
        </Box>
      )}
    </GuideModeContext.Provider>
  );
}
