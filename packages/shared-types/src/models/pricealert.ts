/**
 * Trading price alert domain types.
 */

export type PriceAlertCondition = 'above' | 'below' | 'change_percent';

export interface PriceAlert {
  id: string;
  userId: string;
  commodity: string;
  location?: string;
  condition: PriceAlertCondition;
  threshold: number;
  enabled: boolean;
  lastTriggered?: Date | string;
  createdAt: Date | string;
}

export interface CreatePriceAlertRequest {
  commodity: string;
  location?: string;
  condition: PriceAlertCondition;
  threshold: number;
  enabled?: boolean;
}

export interface UpdatePriceAlertRequest extends Partial<CreatePriceAlertRequest> {
  lastTriggered?: Date | string;
}
