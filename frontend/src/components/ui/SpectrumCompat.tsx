/**
 * Spectrum Compatibility Layer
 *
 * Provides stub implementations for Adobe React Spectrum components
 * that are still referenced in source files during the MUI migration.
 * These components render minimal HTML wrappers so that the app
 * continues to function while the migration is completed.
 */

import {
  Box,
  DialogActions,
  DialogContent,
  DialogTitle,
  Button as MuiButton,
  Dialog as MuiDialog,
  TextField,
} from '@mui/material';
import React from 'react';

/* ---------- DialogContainer ---------- */
export interface DialogContainerProps {
  children?: React.ReactNode;
  onDismiss?: () => void;
  isDismissable?: boolean;
  type?: string;
  [key: string]: unknown;
}

export const DialogContainer: React.FC<DialogContainerProps> = ({
  children,

  ..._props
}) => {
  return <>{children}</>;
};

/* ---------- DialogTrigger ---------- */
export interface DialogTriggerProps {
  children?: React.ReactNode;
  type?: string;
  isDismissable?: boolean;
  isOpen?: boolean;
  onOpenChange?: (isOpen: boolean) => void;
  [key: string]: unknown;
}

export const DialogTrigger: React.FC<DialogTriggerProps> = ({
  children,
  isOpen,
  onOpenChange,
  ..._props
}) => {
  // Clone Dialog children to inject open/onClose props
  const childArray = React.Children.toArray(children);
  return (
    <>
      {childArray.map((child, _index) => {
        if (React.isValidElement(child) && isOpen !== undefined) {
          const ct = child.type as any;
          // Check if it looks like a Dialog via name, displayName, or render.name (ForwardRef)
          const typeName =
            typeof child.type === 'string'
              ? child.type
              : ct?.displayName || ct?.name || ct?.render?.displayName || ct?.render?.name || '';
          if (
            typeName.includes &&
            (typeName.includes('Dialog') || (child.props && 'open' in child.props))
          ) {
            return React.cloneElement(child as React.ReactElement<any>, {
              open: isOpen,
              onClose: () => onOpenChange?.(false),
            });
          }
          // Also try via muiName (MUI convention)
          if (ct?.muiName === 'MuiDialog') {
            return React.cloneElement(child as React.ReactElement<any>, {
              open: isOpen,
              onClose: () => onOpenChange?.(false),
            });
          }
        }
        return child;
      })}
    </>
  );
};

/* ---------- Content ---------- */
export interface ContentProps {
  children?: React.ReactNode;
  [key: string]: unknown;
}

export const Content: React.FC<ContentProps> = ({ children, ..._props }) => {
  return <div>{children}</div>;
};

/* ---------- TypographyField (TextField stub) ---------- */
export interface TypographyFieldProps {
  label?: string;
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  isRequired?: boolean;
  isDisabled?: boolean;
  isReadOnly?: boolean;
  type?: string;
  placeholder?: string;
  width?: string;
  validationState?: string;
  errorMessage?: string;
  description?: string;
  autoFocus?: boolean;
  name?: string;
  maxLength?: number;
  minLength?: number;
  pattern?: string;
  inputMode?: string;
  autoComplete?: string;
  [key: string]: unknown;
}

export const TypographyField: React.FC<TypographyFieldProps> = ({
  label,
  value,
  defaultValue,
  onChange,
  isRequired,
  isDisabled,
  isReadOnly,
  type = 'text',
  placeholder,
  validationState,
  errorMessage,
  description,
  ..._props
}) => {
  return (
    <TextField
      label={label}
      value={value}
      defaultValue={defaultValue}
      onChange={e => onChange?.(e.target.value)}
      required={isRequired}
      disabled={isDisabled}
      type={type}
      placeholder={placeholder}
      error={validationState === 'invalid'}
      helperText={errorMessage || description}
      fullWidth
      size="small"
      variant="outlined"
      slotProps={{
        input: {
          readOnly: isReadOnly,
        },
      }}
    />
  );
};

/* ---------- TypographyArea (TextArea stub) ---------- */
export interface TypographyAreaProps {
  label?: string;
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  isRequired?: boolean;
  isDisabled?: boolean;
  isReadOnly?: boolean;
  placeholder?: string;
  width?: string;
  height?: string;
  maxLength?: number;
  [key: string]: unknown;
}

export const TypographyArea: React.FC<TypographyAreaProps> = ({
  label,
  value,
  defaultValue,
  onChange,
  isRequired,
  isDisabled,
  isReadOnly,
  placeholder,
  ..._props
}) => {
  return (
    <TextField
      label={label}
      value={value}
      defaultValue={defaultValue}
      onChange={e => onChange?.(e.target.value)}
      required={isRequired}
      disabled={isDisabled}
      placeholder={placeholder}
      multiline
      rows={4}
      fullWidth
      size="small"
      variant="outlined"
      slotProps={{
        input: {
          readOnly: isReadOnly,
        },
      }}
    />
  );
};

/* ---------- ButtonGroup ---------- */
export interface ButtonGroupProps {
  children?: React.ReactNode;
  align?: string;
  orientation?: string;
  [key: string]: unknown;
}

export const ButtonGroup: React.FC<ButtonGroupProps> = ({ children, ..._props }) => {
  return <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>{children}</Box>;
};

/* ---------- TabList ---------- */
export interface TabListProps {
  children?: React.ReactNode;
  'aria-label'?: string;
  [key: string]: unknown;
}

export const TabList: React.FC<TabListProps> = ({ children, ..._props }) => {
  return (
    <Box sx={{ display: 'flex', gap: 1, borderBottom: 1, borderColor: 'divider' }}>{children}</Box>
  );
};

/* ---------- TabPanels ---------- */
export interface TabPanelsProps {
  children?: React.ReactNode;
  [key: string]: unknown;
}

export const TabPanels: React.FC<TabPanelsProps> = ({ children, ..._props }) => {
  return <Box sx={{ pt: 2 }}>{children}</Box>;
};

/* ---------- AlertDialog ---------- */
export interface AlertDialogProps {
  title?: string;
  variant?: string;
  primaryActionLabel?: string;
  secondaryActionLabel?: string;
  cancelLabel?: string;
  onPrimaryAction?: () => void;
  onSecondaryAction?: () => void;
  onCancel?: () => void;
  isPrimaryActionDisabled?: boolean;
  children?: React.ReactNode;
  [key: string]: unknown;
}

export const AlertDialog: React.FC<AlertDialogProps> = ({
  title,
  children,
  primaryActionLabel,
  secondaryActionLabel,
  cancelLabel,
  onPrimaryAction,
  onSecondaryAction,
  onCancel,
  isPrimaryActionDisabled,
  ..._props
}) => {
  return (
    <MuiDialog open onClose={onCancel} role="alertdialog">
      {title && <DialogTitle>{title}</DialogTitle>}
      <DialogContent>{children}</DialogContent>
      <DialogActions>
        {cancelLabel && <MuiButton onClick={onCancel}>{cancelLabel}</MuiButton>}
        {secondaryActionLabel && (
          <MuiButton onClick={onSecondaryAction}>{secondaryActionLabel}</MuiButton>
        )}
        {primaryActionLabel && (
          <MuiButton
            onClick={onPrimaryAction}
            color="error"
            variant="contained"
            disabled={isPrimaryActionDisabled}
          >
            {primaryActionLabel}
          </MuiButton>
        )}
      </DialogActions>
    </MuiDialog>
  );
};

/* ---------- MenuTrigger ---------- */
export interface MenuTriggerProps {
  children?: React.ReactNode;
  [key: string]: unknown;
}

export const MenuTrigger: React.FC<MenuTriggerProps> = ({ children, ..._props }) => {
  return <Box sx={{ display: 'inline-block' }}>{children}</Box>;
};

/* ---------- NumberField ---------- */
export interface NumberFieldProps {
  label?: string;
  value?: number;
  defaultValue?: number;
  onChange?: (value: number) => void;
  minValue?: number;
  maxValue?: number;
  step?: number;
  isDisabled?: boolean;
  isRequired?: boolean;
  width?: string | number;
  children?: React.ReactNode;
  [key: string]: unknown;
}

export const NumberField: React.FC<NumberFieldProps> = ({
  label,
  value,
  defaultValue,
  onChange,
  minValue,
  maxValue,
  step,
  isDisabled,
  isRequired,
  width,
  ..._props
}) => {
  return (
    <TextField
      type="number"
      label={label}
      value={value}
      defaultValue={defaultValue}
      onChange={e => onChange?.(Number(e.target.value))}
      inputProps={{ min: minValue, max: maxValue, step }}
      disabled={isDisabled}
      required={isRequired}
      size="small"
      sx={{ width }}
    />
  );
};

/* ---------- Form ---------- */
export interface FormProps {
  children?: React.ReactNode;
  onSubmit?: (e: React.FormEvent) => void;
  isRequired?: boolean;
  validationBehavior?: string;
  [key: string]: unknown;
}

export const Form: React.FC<FormProps> = ({ children, onSubmit, ..._props }) => {
  return <form onSubmit={onSubmit}>{children}</form>;
};

/* ---------- StatusLight ---------- */
export interface StatusLightProps {
  variant?: string;
  children?: React.ReactNode;
  [key: string]: unknown;
}

export const StatusLight: React.FC<StatusLightProps> = ({ children, variant, ..._props }) => {
  const colorMap: Record<string, string> = {
    positive: '#4caf50',
    negative: '#f44336',
    notice: '#ff9800',
    info: '#2196f3',
    neutral: '#9e9e9e',
    celery: '#8bc34a',
    yellow: '#ffeb3b',
    fuchsia: '#e91e63',
    indigo: '#3f51b5',
    seafoam: '#009688',
    chartreuse: '#cddc39',
    magenta: '#e91e63',
    purple: '#9c27b0',
  };
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      <Box
        component="span"
        sx={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          backgroundColor: colorMap[variant || 'neutral'] || '#9e9e9e',
          display: 'inline-block',
        }}
      />
      {children}
    </Box>
  );
};

/* ---------- ListBox ---------- */
export interface ListBoxProps {
  children?: React.ReactNode | ((item: any) => React.ReactNode);
  items?: any[];
  selectionMode?: string;
  onSelectionChange?: (keys: Set<string>) => void;
  'aria-label'?: string;
  [key: string]: unknown;
}

export const ListBox: React.FC<ListBoxProps> = ({
  children,
  items,

  onSelectionChange,
  'aria-label': ariaLabel,
  ...props
}) => {
  const { maxWidth, ...safeProps } = props as any;
  const handleClick = (key: string) => {
    if (onSelectionChange) {
      onSelectionChange(new Set([key]));
    }
  };

  // If items + render function pattern (Spectrum collection)
  if (items && typeof children === 'function') {
    return (
      <Box role="listbox" aria-label={ariaLabel} sx={{ maxWidth: maxWidth || '100%' }}>
        {items.map(item => {
          const rendered = (children as (item: any) => React.ReactNode)(item);
          if (React.isValidElement(rendered) && rendered.key) {
            return (
              <Box
                key={rendered.key}
                role="option"
                onClick={() => handleClick(String(rendered.key))}
                sx={{ cursor: 'pointer', p: 1, '&:hover': { bgcolor: 'action.hover' } }}
              >
                {rendered}
              </Box>
            );
          }
          return rendered;
        })}
      </Box>
    );
  }

  return (
    <Box role="listbox" aria-label={ariaLabel} sx={{ maxWidth: maxWidth || '100%' }} {...safeProps}>
      {children}
    </Box>
  );
};
