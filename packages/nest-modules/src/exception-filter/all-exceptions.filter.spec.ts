import { ApiError } from '@carlba/core';
import { BadRequestException, Logger, NotFoundException } from '@nestjs/common';
import type { ArgumentsHost } from '@nestjs/common';
import type { HttpAdapterHost } from '@nestjs/core';
import type { MockInstance } from 'vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AllExceptionsFilter } from './all-exceptions.filter.js';

describe('AllExceptionsFilter', () => {
  const response = { id: 'response' };
  const reply = vi.fn();
  const host = {
    switchToHttp: () => ({ getResponse: () => response }),
  } as unknown as ArgumentsHost;
  const filter = new AllExceptionsFilter({ httpAdapter: { reply } } as unknown as HttpAdapterHost);

  let warn: MockInstance<Logger['warn']>;
  let error: MockInstance<Logger['error']>;

  beforeEach(() => {
    reply.mockClear();
    warn = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    error = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('responds with the ApiError status code and message, and logs a warning', () => {
    const exception = new ApiError('User not found: id=7', { statusCode: 404 });

    filter.catch(exception, host);

    expect(reply).toHaveBeenCalledWith(
      response,
      { statusCode: 404, message: 'User not found: id=7' },
      404
    );
    expect(warn).toHaveBeenCalledWith({ err: exception, statusCode: 404 }, 'User not found: id=7');
    expect(error).not.toHaveBeenCalled();
  });

  it('hides the message of a 5xx ApiError from the client but logs it with its cause', () => {
    const cause = new Error('connection refused');
    const exception = new ApiError('Failed to load user: id=7', { statusCode: 502, cause });

    filter.catch(exception, host);

    expect(reply).toHaveBeenCalledWith(
      response,
      { statusCode: 502, message: 'Internal server error' },
      502
    );
    expect(error).toHaveBeenCalledWith(
      { err: exception, statusCode: 502 },
      'Failed to load user: id=7'
    );
    expect(exception.cause).toBe(cause);
  });

  it('keeps the status and body of a Nest HttpException', () => {
    filter.catch(new NotFoundException('Cannot GET /missing'), host);

    expect(reply).toHaveBeenCalledWith(
      response,
      { message: 'Cannot GET /missing', error: 'Not Found', statusCode: 404 },
      404
    );
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('passes through the details Nest puts in a BadRequestException body', () => {
    const details = { statusCode: 400, message: 'Validation failed', issues: [{ path: 'name' }] };

    filter.catch(new BadRequestException(details), host);

    expect(reply).toHaveBeenCalledWith(response, details, 400);
  });

  it('answers 500 with a generic message for an unexpected error and logs it as an error', () => {
    const exception = new Error('database password is hunter2');

    filter.catch(exception, host);

    expect(reply).toHaveBeenCalledWith(
      response,
      { statusCode: 500, message: 'Internal server error' },
      500
    );
    expect(error).toHaveBeenCalledWith(
      { err: exception, statusCode: 500 },
      'database password is hunter2'
    );
  });

  it('handles a thrown value that is not an Error', () => {
    filter.catch('just a string', host);

    expect(reply).toHaveBeenCalledWith(
      response,
      { statusCode: 500, message: 'Internal server error' },
      500
    );
    expect(error).toHaveBeenCalledWith(
      { err: 'just a string', statusCode: 500 },
      'Unknown exception thrown'
    );
  });
});
