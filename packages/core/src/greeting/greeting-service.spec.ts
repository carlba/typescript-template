import type { Logger } from '@carlba/logger';
import { describe, expect, it, vi } from 'vitest';

import { GreetingService } from '../greeting/greeting-service.js';

function createMockLogger(): Logger {
  return {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    trace: vi.fn(),
    fatal: vi.fn(),
    child: vi.fn().mockReturnThis(),
  } as unknown as Logger;
}

describe('GreetingService', () => {
  it('greets a provided name', () => {
    const greetingService = new GreetingService({ logger: createMockLogger() });

    expect(greetingService.create('Carl')).toBe('Hello, Carl!');
  });

  it('falls back to a default greeting when no name is given', () => {
    const greetingService = new GreetingService({ logger: createMockLogger() });

    expect(greetingService.create()).toBe('Hello, world!');
  });
});
