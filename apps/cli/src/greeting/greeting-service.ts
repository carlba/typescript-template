import type { Logger } from '@carlba/logger';

export class GreetingService {
  logger: Logger;
  constructor(readonly dependencies: { logger: Logger }) {
    this.logger = dependencies.logger.child({ module: 'GreetingService' });
  }
  create(name?: string): string {
    this.logger.debug({ name }, 'Creating greeting');
    return `Hello, ${name ?? 'world'}!`;
  }
}
