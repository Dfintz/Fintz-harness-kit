import type { Theme } from '@mui/material/styles';

/**
 * Maps semantic color strings to MUI theme foreground colors
 * Respects dark/light theme mode for neutral colors
 *
 * @param semantic - Semantic color identifier (positive, negative, info, yellow, warning, neutral)
 * @param theme - MUI Theme instance
 * @returns Theme-based color string respecting dark/light mode
 *
 * @example
 * ```tsx
 * const theme = useTheme();
 * const color = mapSemanticToThemeColor('positive', theme);
 * <Box sx={{ color }}>Success!</Box>
 * ```
 */
export const mapSemanticToThemeColor = (semantic: string, theme: Theme): string => {
  switch (semantic) {
    case 'positive':
      return theme.palette.success.main;
    case 'negative':
      return theme.palette.error.main;
    case 'info':
      return theme.palette.info.main;
    case 'yellow':
    case 'warning':
      return theme.palette.warning.main;
    case 'neutral':
    default:
      return theme.palette.mode === 'dark' ? theme.palette.grey[400] : theme.palette.grey[700];
  }
};

/**
 * Maps semantic color strings to MUI theme background colors with opacity
 * Returns color strings with hex opacity suffix '26' (~15% opacity)
 * Respects dark/light theme mode
 *
 * @param semantic - Semantic color identifier (positive, negative, info, yellow, warning, neutral)
 * @param theme - MUI Theme instance
 * @returns Theme-based background color with ~15% opacity (hex suffix 26)
 *
 * @example
 * ```tsx
 * const theme = useTheme();
 * const bgcolor = mapSemanticToThemeBgColor('positive', theme);
 * <Box sx={{ backgroundColor: bgcolor }}>Success background</Box>
 * ```
 */
export const mapSemanticToThemeBgColor = (semantic: string, theme: Theme): string => {
  switch (semantic) {
    case 'positive':
      return theme.palette.mode === 'dark'
        ? `${theme.palette.success.dark}26` // ~15% opacity
        : `${theme.palette.success.light}26`;
    case 'negative':
      return theme.palette.mode === 'dark'
        ? `${theme.palette.error.dark}26`
        : `${theme.palette.error.light}26`;
    case 'info':
      return theme.palette.mode === 'dark'
        ? `${theme.palette.info.dark}26`
        : `${theme.palette.info.light}26`;
    case 'yellow':
    case 'warning':
      return theme.palette.mode === 'dark'
        ? `${theme.palette.warning.dark}26`
        : `${theme.palette.warning.light}26`;
    case 'neutral':
    default:
      return theme.palette.mode === 'dark'
        ? `${theme.palette.grey[700]}26`
        : `${theme.palette.grey[300]}26`;
  }
};

/**
 * Maps sharing/visibility level values to theme color pairs
 * Returns both foreground color and background color with opacity
 * Background uses hex opacity suffix '1F' (~12% opacity)
 * Respects dark/light theme mode
 *
 * @param level - Sharing level (private, personal, shared_users, organization, alliance, public)
 * @param theme - MUI Theme instance
 * @returns Object with foreground color and background color (~12% opacity, hex suffix 1F)
 *
 * @example
 * ```tsx
 * const theme = useTheme();
 * const { color, backgroundColor } = getSharingLevelColors('organization', theme);
 * <Chip label="Organization" sx={{ color, backgroundColor }} />
 * ```
 */
export const getSharingLevelColors = (
  level: string,
  theme: Theme
): { color: string; backgroundColor: string } => {
  switch (level) {
    case 'private':
      return {
        color: theme.palette.error.main,
        backgroundColor:
          theme.palette.mode === 'dark'
            ? `${theme.palette.error.dark}1F`
            : `${theme.palette.error.light}1F`,
      };
    case 'personal':
      return {
        color: theme.palette.warning.main,
        backgroundColor:
          theme.palette.mode === 'dark'
            ? `${theme.palette.warning.dark}1F`
            : `${theme.palette.warning.light}1F`,
      };
    case 'shared_users':
      return {
        color: theme.palette.secondary.main,
        backgroundColor:
          theme.palette.mode === 'dark'
            ? `${theme.palette.secondary.dark}1F`
            : `${theme.palette.secondary.light}1F`,
      };
    case 'organization':
      return {
        color: theme.palette.primary.main,
        backgroundColor:
          theme.palette.mode === 'dark'
            ? `${theme.palette.primary.dark}1F`
            : `${theme.palette.primary.light}1F`,
      };
    case 'alliance':
      return {
        color: theme.palette.info.main,
        backgroundColor:
          theme.palette.mode === 'dark'
            ? `${theme.palette.info.dark}1F`
            : `${theme.palette.info.light}1F`,
      };
    case 'public':
      return {
        color: theme.palette.success.main,
        backgroundColor:
          theme.palette.mode === 'dark'
            ? `${theme.palette.success.dark}1F`
            : `${theme.palette.success.light}1F`,
      };
    default:
      return {
        color: theme.palette.grey[500],
        backgroundColor:
          theme.palette.mode === 'dark'
            ? `${theme.palette.grey[700]}1F`
            : `${theme.palette.grey[300]}1F`,
      };
  }
};
