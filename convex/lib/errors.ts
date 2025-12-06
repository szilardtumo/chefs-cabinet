/**
 * Custom error classes for Convex functions
 */

/**
 * Thrown when a user is not authenticated
 */
export class UnauthenticatedError extends Error {
  constructor(message: string = 'Not authenticated') {
    super(message);
    this.name = 'UnauthenticatedError';
  }
}

/**
 * Thrown when a user is authenticated but not authorized to access a resource
 */
export class UnauthorizedError extends Error {
  constructor(message: string = 'Unauthorized') {
    super(message);
    this.name = 'UnauthorizedError';
  }
}

/**
 * Thrown when a requested resource is not found
 */
export class NotFoundError extends Error {
  constructor(resource: string, id?: string) {
    const message = id ? `${resource} with ID ${id} not found` : `${resource} not found`;
    super(message);
    this.name = 'NotFoundError';
  }
}

/**
 * Thrown when an operation fails due to invalid data or business logic
 */
export class InvalidOperationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidOperationError';
  }
}

/**
 * Thrown when input validation fails
 */
export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

/**
 * Thrown when an AI error occurs
 */
export class AIError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AIError';
  }
}
