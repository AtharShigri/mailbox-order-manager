import { describe, it, expect } from 'vitest';
import { OrderStateMachine } from '@/core/state-machine';
import { OrderStatus, UserRole } from '@prisma/client';
import { InvalidStateTransitionError, ForbiddenError } from '@/core/errors';

describe('OrderStateMachine Unit Tests', () => {
  describe('Valid transitions', () => {
    it('allows PENDING -> PROVISIONING', () => {
      expect(OrderStateMachine.isAllowed(OrderStatus.PENDING, OrderStatus.PROVISIONING)).toBe(true);
      expect(() =>
        OrderStateMachine.validate({
          from: OrderStatus.PENDING,
          to: OrderStatus.PROVISIONING,
        })
      ).not.toThrow();
    });

    it('allows PROVISIONING -> ACTIVE', () => {
      expect(OrderStateMachine.isAllowed(OrderStatus.PROVISIONING, OrderStatus.ACTIVE)).toBe(true);
      expect(() =>
        OrderStateMachine.validate({
          from: OrderStatus.PROVISIONING,
          to: OrderStatus.ACTIVE,
        })
      ).not.toThrow();
    });

    it('allows PROVISIONING -> FAILED', () => {
      expect(OrderStateMachine.isAllowed(OrderStatus.PROVISIONING, OrderStatus.FAILED)).toBe(true);
      expect(() =>
        OrderStateMachine.validate({
          from: OrderStatus.PROVISIONING,
          to: OrderStatus.FAILED,
        })
      ).not.toThrow();
    });

    it('allows FAILED -> PENDING when actor is ADMIN (Retry)', () => {
      expect(OrderStateMachine.isAllowed(OrderStatus.FAILED, OrderStatus.PENDING)).toBe(true);
      expect(() =>
        OrderStateMachine.validate({
          from: OrderStatus.FAILED,
          to: OrderStatus.PENDING,
          actorRole: UserRole.ADMIN,
        })
      ).not.toThrow();
    });
  });

  describe('Invalid and unauthorized transitions', () => {
    it('rejects FAILED -> PENDING when actor is CUSTOMER', () => {
      expect(() =>
        OrderStateMachine.validate({
          from: OrderStatus.FAILED,
          to: OrderStatus.PENDING,
          actorRole: UserRole.CUSTOMER,
        })
      ).toThrow(ForbiddenError);
    });

    it('rejects PENDING -> ACTIVE directly', () => {
      expect(OrderStateMachine.isAllowed(OrderStatus.PENDING, OrderStatus.ACTIVE)).toBe(false);
      expect(() =>
        OrderStateMachine.validate({
          from: OrderStatus.PENDING,
          to: OrderStatus.ACTIVE,
        })
      ).toThrow(InvalidStateTransitionError);
    });

    it('rejects PENDING -> FAILED directly', () => {
      expect(OrderStateMachine.isAllowed(OrderStatus.PENDING, OrderStatus.FAILED)).toBe(false);
      expect(() =>
        OrderStateMachine.validate({
          from: OrderStatus.PENDING,
          to: OrderStatus.FAILED,
        })
      ).toThrow(InvalidStateTransitionError);
    });

    it('rejects ACTIVE -> any other state (terminal state)', () => {
      const allStates: OrderStatus[] = [
        OrderStatus.PENDING,
        OrderStatus.PROVISIONING,
        OrderStatus.FAILED,
      ];

      for (const target of allStates) {
        expect(OrderStateMachine.isAllowed(OrderStatus.ACTIVE, target)).toBe(false);
        expect(() =>
          OrderStateMachine.validate({
            from: OrderStatus.ACTIVE,
            to: target,
            actorRole: UserRole.ADMIN,
          })
        ).toThrow(InvalidStateTransitionError);
      }
    });

    it('rejects FAILED -> ACTIVE directly', () => {
      expect(OrderStateMachine.isAllowed(OrderStatus.FAILED, OrderStatus.ACTIVE)).toBe(false);
      expect(() =>
        OrderStateMachine.validate({
          from: OrderStatus.FAILED,
          to: OrderStatus.ACTIVE,
          actorRole: UserRole.ADMIN,
        })
      ).toThrow(InvalidStateTransitionError);
    });
  });

  describe('Allowed next states inspection', () => {
    it('returns [PROVISIONING] for PENDING', () => {
      expect(OrderStateMachine.getAllowedNextStates(OrderStatus.PENDING)).toEqual([
        OrderStatus.PROVISIONING,
      ]);
    });

    it('returns [ACTIVE, FAILED] for PROVISIONING', () => {
      expect(OrderStateMachine.getAllowedNextStates(OrderStatus.PROVISIONING)).toEqual([
        OrderStatus.ACTIVE,
        OrderStatus.FAILED,
      ]);
    });

    it('returns [] for ACTIVE (terminal state)', () => {
      expect(OrderStateMachine.getAllowedNextStates(OrderStatus.ACTIVE)).toEqual([]);
    });

    it('returns [PENDING] for FAILED only if actor is ADMIN', () => {
      expect(OrderStateMachine.getAllowedNextStates(OrderStatus.FAILED, UserRole.ADMIN)).toEqual([
        OrderStatus.PENDING,
      ]);
      expect(OrderStateMachine.getAllowedNextStates(OrderStatus.FAILED, UserRole.CUSTOMER)).toEqual(
        []
      );
    });
  });
});

