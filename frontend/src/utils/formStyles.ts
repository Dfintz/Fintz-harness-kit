/**
 * Shared dark-theme form field styles for MUI TextField and FormControl/Select.
 *
 * Extracted from FederationManagePage to enable reuse across dark-themed pages.
 */
import type { Theme } from '@mui/material/styles';
import { alpha } from '@mui/material/styles';

/** Dark-theme styling for MUI TextField (outlined variant). */
export const darkFieldSx = (theme: Theme) => ({
  '& .MuiOutlinedInput-root': {
    backgroundColor: alpha(theme.palette.background.default, 0.6),
    color: 'common.white',
    '& fieldset': { borderColor: alpha(theme.palette.primary.main, 0.25) },
    '&:hover fieldset': { borderColor: alpha(theme.palette.primary.main, 0.5) },
    '&.Mui-focused fieldset': { borderColor: theme.palette.primary.main },
  },
  '& .MuiInputLabel-root': { color: alpha(theme.palette.common.white, 0.5) },
  '& .MuiInputLabel-root.Mui-focused': { color: theme.palette.primary.main },
  '& .MuiFormHelperText-root': { color: alpha(theme.palette.common.white, 0.4) },
});

/** Dark-theme styling for MUI FormControl wrapping a Select. */
export const darkSelectSx = (theme: Theme) => ({
  '& .MuiOutlinedInput-root': {
    backgroundColor: alpha(theme.palette.background.default, 0.6),
    color: 'common.white',
    '& fieldset': { borderColor: alpha(theme.palette.primary.main, 0.25) },
    '&:hover fieldset': { borderColor: alpha(theme.palette.primary.main, 0.5) },
    '&.Mui-focused fieldset': { borderColor: theme.palette.primary.main },
  },
  '& .MuiInputLabel-root': { color: alpha(theme.palette.common.white, 0.5) },
  '& .MuiSelect-icon': { color: alpha(theme.palette.common.white, 0.5) },
});
