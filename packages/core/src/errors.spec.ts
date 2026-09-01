import { describe, expect, it } from 'vitest';

import { ApiError } from './errors.js';

describe('ApiError', () => {
  it('sets message and statusCode', () => {
    const error = new ApiError('User not found: id=123', { statusCode: 404 });

    expect(error.message).toBe('User not found: id=123');
    expect(error.statusCode).toBe(404);
  });

  it('sets name to ApiError', () => {
    const error = new ApiError('Something failed', { statusCode: 500 });

    expect(error.name).toBe('ApiError');
  });

  it('is an instance of Error', () => {
    const error = new ApiError('Something failed', { statusCode: 500 });

    expect(error).toBeInstanceOf(Error);
  });

  it('preserves the cause when provided', () => {
    const cause = new Error('Underlying failure');
    const error = new ApiError('Failed to load user: id=123', { statusCode: 404, cause });

    expect(error.cause).toBe(cause);
  });

  it('leaves cause undefined when not provided', () => {
    const error = new ApiError('Something failed', { statusCode: 500 });

    expect(error.cause).toBeUndefined();
  });
});
