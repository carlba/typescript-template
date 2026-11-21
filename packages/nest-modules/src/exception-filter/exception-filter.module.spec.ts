import 'reflect-metadata';
import { ApiError } from '@carlba/core';
import { Controller, Get, Logger } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { afterEach, beforeEach, describe, it, vi } from 'vitest';
import { ExceptionFilterModule } from './exception-filter.module.js';

@Controller()
class ThrowingController {
  @Get('api-error')
  throwApiError(): never {
    throw new ApiError('Widget not found: id=3', { statusCode: 404 });
  }

  @Get('unexpected')
  throwUnexpected(): never {
    throw new Error('secret internal detail');
  }
}

describe('ExceptionFilterModule', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);

    const moduleRef = await Test.createTestingModule({
      imports: [ExceptionFilterModule],
      controllers: [ThrowingController],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
    vi.restoreAllMocks();
  });

  it('answers a thrown ApiError with its status code and message', () => {
    return request(app.getHttpServer())
      .get('/api-error')
      .expect(404)
      .expect({ statusCode: 404, message: 'Widget not found: id=3' });
  });

  it('answers an unexpected error with a generic 500', () => {
    return request(app.getHttpServer())
      .get('/unexpected')
      .expect(500)
      .expect({ statusCode: 500, message: 'Internal server error' });
  });

  it('keeps the 404 Nest builds for an unknown route', () => {
    return request(app.getHttpServer()).get('/missing').expect(404);
  });
});
