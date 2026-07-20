/**
 * Item Component - Generic item component for Select, Table, etc.
 * Primarily used as a container for Select items in Spectrum-style code
 */

import React from 'react';

export interface ItemProps {
  /** Unique key for the item */
  key?: string | number;
  /** Text value for searching/filtering */
  textValue?: string;
  /** Whether the item is disabled */
  disabled?: boolean;
  /** Children content */
  children?: React.ReactNode;
}

/**
 * Item - Used within Select and other composite components
 * This component doesn't render directly; it's consumed by parent components
 */
export const Item: React.FC<ItemProps> = ({ children }) => {
  // This component is consumed by parent components and doesn't render directly
  return <>{children}</>;
};
