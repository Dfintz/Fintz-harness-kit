/**
 * SC Fleet Manager Design System - UI Component Library
 *
 * This module exports all UI components from the design system.
 * Use these components for consistent styling across the application.
 *
 * @example
 * import { Button, Card, Modal, Input, Select, Table, useToast, Skeleton } from '@/components/ui';
 */

// Core Components
export { Button } from './Button';
export type { ButtonProps } from './Button';

export { IconButton } from './IconButton';
export type { IconButtonProps } from './IconButton';

export { Input } from './Input';
export type { InputProps } from './Input';

export { Select } from './Select';
export type { SelectOption, SelectProps } from './Select';

export { Item } from './Item';
export type { ItemProps } from './Item';

export { Divider } from './Divider';
export type { DividerProps } from './Divider';

export { Grid } from './Grid';
export type { GridProps } from './Grid';

export { SearchField } from './SearchField';
export type { SearchFieldProps } from './SearchField';

export { Checkbox } from './Checkbox';
export type { CheckboxProps } from './Checkbox';

export { Radio } from './Radio';
export type { RadioOption, RadioProps } from './Radio';

export { Modal } from './Modal';
export type { ModalProps } from './Modal';

export { Card } from './Card';
export type { CardProps } from './Card';

export { Well } from './Well';
export type { WellProps } from './Well';

// Table removed — use DataTable from '@/components/shared/DataTable' instead

export { ToastProvider, useToast } from './Toast';
export type { ToastOptions, ToastPosition, ToastVariant } from './Toast';

// Typography Components
export { Caption, Code, Display, Heading, Label, Text } from './Typography';
export type {
  CaptionProps,
  CodeProps,
  DisplayProps,
  DisplaySize,
  HeadingLevel,
  HeadingProps,
  LabelProps,
  TextAlign,
  TextColor,
  TextProps,
  TextSize,
  TextWeight,
} from './Typography';

// Sparkline and Trend Components
export { Sparkline, generateSparklineData } from './Sparkline';
export type { SparklineDataPoint, SparklineProps } from './Sparkline';

export {
  TrendIndicator,
  calculatePercentageChange,
  calculateTrendDirection,
} from './TrendIndicator';
export type { TrendDirection, TrendIndicatorProps } from './TrendIndicator';

export { PeriodComparison, usePeriodComparison } from './PeriodComparison';
export type { ComparisonPeriod, PeriodComparisonProps } from './PeriodComparison';

// Skeleton loading components
export {
  CardSkeleton,
  DashboardSkeleton,
  ListSkeleton,
  ProfileSkeleton,
  Skeleton,
  TableSkeleton,
} from './Skeleton';

// MUI-based skeleton cards (preferred for new code)
export { SkeletonCard } from './SkeletonCard';
export type { SkeletonCardProps, SkeletonCardVariant } from './SkeletonCard';

// Breadcrumbs navigation
export { Breadcrumbs } from './Breadcrumbs';

// QuickActionCard for dashboard actions
export { QuickActionCard } from './QuickActionCard';
export type { QuickActionCardProps } from './QuickActionCard';

// Glass Morphism Components
export { GlassCard } from './GlassCard';
export type { GlassCardProps, GlassCardSize, GlassVariant, GlowColor } from './GlassCard';

// GlassModal removed — use Modal from './Modal' instead (MUI Dialog‑backed)

export { GlassPanel } from './GlassPanel';
export type { GlassPanelPosition, GlassPanelProps, GlassPanelVariant } from './GlassPanel';

// GlassButton Component
export { GlassButton } from './GlassButton';
export type { GlassButtonProps, GlassButtonSize, GlassButtonVariant } from './GlassButton';

// Empty State Components
export { EmptyState } from './EmptyState';
export type {
  EmptyStateAction,
  EmptyStatePreset,
  EmptyStateProps,
  EmptyStateSize,
} from './EmptyState';

// Empty State Illustrations
export {
  DataIllustration,
  ErrorIllustration,
  EventsIllustration,
  InventoryIllustration,
  MembersIllustration,
  SearchIllustration,
  ShipsIllustration,
  SuccessIllustration,
  illustrations,
} from './illustrations/EmptyStateIllustrations';
export type { IllustrationProps, IllustrationType } from './illustrations/EmptyStateIllustrations';

// MUI re-exports (for files importing from @/components/ui)
export {
  Badge,
  Box,
  CircularProgress,
  Dialog,
  Stack,
  Switch,
  Tab,
  Tabs,
  Typography,
} from '@mui/material';

// Spectrum Compatibility Stubs
export {
  AlertDialog,
  ButtonGroup,
  Content,
  DialogContainer,
  DialogTrigger,
  Form,
  ListBox,
  MenuTrigger,
  NumberField,
  StatusLight,
  TabList,
  TabPanels,
  TypographyArea,
  TypographyField,
} from './SpectrumCompat';
export type {
  AlertDialogProps,
  ButtonGroupProps,
  ContentProps,
  DialogContainerProps,
  DialogTriggerProps,
  FormProps,
  ListBoxProps,
  MenuTriggerProps,
  NumberFieldProps,
  StatusLightProps,
  TabListProps,
  TabPanelsProps,
  TypographyAreaProps,
  TypographyFieldProps,
} from './SpectrumCompat';

// Tokens
export * from './tokens';

// Accessibility Components and Utilities
export {
  FocusTrap,
  LiveRegion,
  // Components
  SkipLink,
  VisuallyHidden,
  // Colors
  a11yColors,
  generateId,
  getAccessibleTextColor,
  getContrastColor,
  useAnnounce,
  useArrowNavigation,
  // Hooks
  useFocusTrap,
  useFocusVisible,
  useHighContrast,
  useLiveRegion,
  useReducedMotion,
  withVisuallyHiddenLabel,
} from './accessibility';
export type {
  A11yColorPalette,
  ColorWithContrast,
  FocusTrapProps,
  LiveRegionPoliteness,
  LiveRegionProps,
  SkipLinkProps,
  UseAnnounceReturn,
  UseArrowNavigationOptions,
  UseFocusTrapOptions,
  UseFocusVisibleReturn,
  UseLiveRegionOptions,
  UseLiveRegionReturn,
  VisuallyHiddenProps,
} from './accessibility';

// Onboarding Components
export { DEFAULT_ONBOARDING_CONFIG, OnboardingProvider, useOnboarding } from './Onboarding';
export type {
  OnboardingConfig,
  OnboardingContextValue,
  OnboardingProviderProps,
  OnboardingStep,
  OnboardingStepPosition,
} from './Onboarding';

// Help Tooltip Components
export { HelpTooltip } from './HelpTooltip';
export type { HelpTooltipProps, TooltipPosition } from './HelpTooltip';
