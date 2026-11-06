export class DomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DomainError';
  }
}

export class ValidationError extends DomainError {
  constructor(message: string, public readonly errors?: Record<string, string[]>) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class InvalidStateTransitionError extends DomainError {
  constructor(public readonly from: string, public readonly to: string) {
    super(`Invalid order state transition from '${from}' to '${to}'`);
    this.name = 'InvalidStateTransitionError';
  }
}

export class NotFoundError extends DomainError {
  constructor(entity: string, id: string) {
    super(`${entity} with id '${id}' not found`);
    this.name = 'NotFoundError';
  }
}

export class UnauthorizedError extends DomainError {
  constructor(message = 'Unauthorized') {
    super(message);
    this.name = 'UnauthorizedError';
  }
}

export class ForbiddenError extends DomainError {
  constructor(message = 'Forbidden') {
    super(message);
    this.name = 'ForbiddenError';
  }
}

