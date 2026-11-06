import { NextResponse } from 'next/server';
import {
  DomainError,
  ValidationError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  InvalidStateTransitionError,
} from '@/core/errors';

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export function jsonSuccess<T>(data: T, status = 200): NextResponse<ApiResponse<T>> {
  return NextResponse.json({ success: true, data }, { status });
}

export function jsonError(error: unknown): NextResponse<ApiResponse<null>> {
  if (error instanceof ValidationError) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: error.message,
          details: error.errors,
        },
      },
      { status: 400 }
    );
  }

  if (error instanceof UnauthorizedError) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: error.message,
        },
      },
      { status: 401 }
    );
  }

  if (error instanceof ForbiddenError) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: error.message,
        },
      },
      { status: 403 }
    );
  }

  if (error instanceof NotFoundError) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: error.message,
        },
      },
      { status: 404 }
    );
  }

  if (error instanceof InvalidStateTransitionError) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INVALID_STATE_TRANSITION',
          message: error.message,
          details: { from: error.from, to: error.to },
        },
      },
      { status: 422 }
    );
  }

  if (error instanceof DomainError) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'DOMAIN_ERROR',
          message: error.message,
        },
      },
      { status: 400 }
    );
  }

  console.error('Unhandled server error:', error);
  return NextResponse.json(
    {
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An unexpected internal error occurred',
      },
    },
    { status: 500 }
  );
}
