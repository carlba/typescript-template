import { ApiError } from '@carlba/core';
import { Catch, HttpException, HttpStatus, Logger } from '@nestjs/common';
import type { ArgumentsHost, ExceptionFilter } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';

const SERVER_ERROR_MIN_STATUS = 500;
// Sent instead of the real message for 5xx errors, which can expose internals to the client.
const INTERNAL_ERROR_MESSAGE = 'Internal server error';

interface ErrorResponse {
  statusCode: number;
  message: string;
}

interface HandledError {
  statusCode: number;
  body: object;
}

/**
 * The one place that turns an error into an HTTP response and logs it. Services throw `ApiError`
 * and controllers do not catch; see `.claude/rules/backend-nest.md`.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  // HttpAdapterHost instead of `@Res()`, so the filter does not depend on Express or Fastify.
  constructor(private readonly httpAdapterHost: HttpAdapterHost) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const { statusCode, body } = this.handle(exception);
    this.log(exception, statusCode);
    this.httpAdapterHost.httpAdapter.reply(host.switchToHttp().getResponse(), body, statusCode);
  }

  private handle(exception: unknown): HandledError {
    if (exception instanceof ApiError) {
      const { statusCode } = exception;
      return { statusCode, body: this.toErrorResponse(statusCode, exception.message) };
    }

    if (exception instanceof HttpException) {
      const statusCode = exception.getStatus();
      const response = exception.getResponse();
      // Keep the body Nest built (e.g. the details of a validation failure) when it is an object.
      return {
        statusCode,
        body: typeof response === 'object' ? response : this.toErrorResponse(statusCode, response),
      };
    }

    const statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
    return { statusCode, body: this.toErrorResponse(statusCode, INTERNAL_ERROR_MESSAGE) };
  }

  private toErrorResponse(statusCode: number, message: string): ErrorResponse {
    const isServerError = statusCode >= SERVER_ERROR_MIN_STATUS;
    return { statusCode, message: isServerError ? INTERNAL_ERROR_MESSAGE : message };
  }

  private log(exception: unknown, statusCode: number): void {
    const message = exception instanceof Error ? exception.message : 'Unknown exception thrown';
    // `err` is the key pino expands into type, message, stack and the `cause` chain. The object
    // goes first because pino drops an object passed after the message.
    const fields = { err: exception, statusCode };

    if (statusCode >= SERVER_ERROR_MIN_STATUS) {
      this.logger.error(fields, message);
    } else {
      this.logger.warn(fields, message);
    }
  }
}
