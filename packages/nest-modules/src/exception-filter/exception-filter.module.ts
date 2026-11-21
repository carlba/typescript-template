import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { AllExceptionsFilter } from './all-exceptions.filter.js';

/**
 * Importing this module once (in the root module) registers {@link AllExceptionsFilter} as the
 * global exception filter. APP_FILTER providers apply app-wide regardless of which module declares
 * them.
 */
@Module({
  providers: [{ provide: APP_FILTER, useClass: AllExceptionsFilter }],
})
export class ExceptionFilterModule {}
