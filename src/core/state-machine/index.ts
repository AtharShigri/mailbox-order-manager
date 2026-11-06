export type OrderState = 'PENDING' | 'PROVISIONING' | 'ACTIVE' | 'FAILED';

export interface StateTransitionResult {
  allowed: boolean;
  reason?: string;
}

