import { StyleSheet } from 'react-native';
import { BorderRadius, Colors, Shadows, Spacing } from './theme';

/**
 * Common screen layout styles used across multiple screens
 * to reduce code duplication and maintain consistency
 */
export const ScreenStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  // Used for ScrollView content padding
  content: {
    padding: Spacing.lg,
  },
  // Used for FlatList contentContainerStyle padding
  listContent: {
    padding: Spacing.lg,
  },
  header: {
    marginBottom: Spacing.lg,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: Colors.primary,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: Colors.textSecondary,
  },
});

/**
 * Common card styles for list items and content sections
 */
export const CardStyles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    ...Shadows.medium,
  },
  section: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginTop: Spacing.sm,
    marginBottom: Spacing.lg,
    ...Shadows.medium,
  },
});

/**
 * Auth form styles shared between Login and Register screens
 */
export const AuthStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    padding: Spacing.xl,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: Colors.primary,
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  subtitle: {
    fontSize: 20,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: 48,
  },
  form: {
    gap: Spacing.lg,
  },
  input: {
    height: 48,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.lg,
    fontSize: 16,
    backgroundColor: Colors.surface,
    color: Colors.text,
  },
  button: {
    height: 48,
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: Spacing.sm,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: Colors.textInverse,
    fontSize: 16,
    fontWeight: '600',
  },
  linkText: {
    color: Colors.primary,
    fontSize: 14,
    textAlign: 'center',
    marginTop: Spacing.sm,
  },
  error: {
    color: Colors.error,
    fontSize: 14,
    textAlign: 'center',
  },
});
