import { OrderStatus, UserRole } from '@prisma/client';
import { InvalidStateTransitionError, ForbiddenError } from '@/core/errors';

export interface TransitionContext {
  from: OrderStatus;
  to: OrderStatus;
  actorRole?: UserRole;
  actorId?: string;
  reason?: string;
}

export class OrderStateMachine {
  private static readonly ALLOWED_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
    [OrderStatus.PENDING]: [OrderStatus.PROVISIONING],
    [OrderStatus.PROVISIONING]: [OrderStatus.ACTIVE, OrderStatus.FAILED],
    [OrderStatus.ACTIVE]: [],
    [OrderStatus.FAILED]: [OrderStatus.PENDING],
  };

  /**
   * Checks if a transition between two states is structurally allowed.
   */
  static isAllowed(from: OrderStatus, to: OrderStatus): boolean {
    const allowed = this.ALLOWED_TRANSITIONS[from];
    return allowed ? allowed.includes(to) : false;
  }

  /**
   * Validates a transition and checks actor authorization rules.
   * Throws InvalidStateTransitionError or ForbiddenError if disallowed.
   */
  static validate(context: TransitionContext): void {
    const { from, to, actorRole } = context;

    if (!this.isAllowed(from, to)) {
      throw new InvalidStateTransitionError(from, to);
    }

    // Role-specific transition guard: FAILED -> PENDING requires ADMIN
    if (from === OrderStatus.FAILED && to === OrderStatus.PENDING) {
      if (actorRole !== UserRole.ADMIN) {
        throw new ForbiddenError('Only administrators can retry failed orders (FAILED -> PENDING)');
      }
    }
  }

  /**
   * Returns list of allowed target states for a given state and actor role.
   */
  static getAllowedNextStates(from: OrderStatus, actorRole?: UserRole): OrderStatus[] {
    const candidates = this.ALLOWED_TRANSITIONS[from] || [];
    return candidates.filter((target) => {
      if (from === OrderStatus.FAILED && target === OrderStatus.PENDING) {
        return actorRole === UserRole.ADMIN;
      }
      return true;
    });
  }
}
