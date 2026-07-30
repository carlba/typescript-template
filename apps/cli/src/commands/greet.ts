import { GreetingService } from '@carlba/core';
import type { Logger } from '@carlba/logger';
import { Command } from 'commander';

import type { Config } from '../schema.js';

export function registerGreetCommand(program: Command, config: Config, logger: Logger): void {
  program
    .command('greet')
    .description('Greet the user')
    .option('-n, --name <name>', 'name to greet')
    .action((options: { name?: string }) => {
      const greetingService = new GreetingService({ logger });
      const greeting = greetingService.create(options.name);

      logger.debug({ name: options.name }, 'greet command executed');

      if (config.isDevelopment) {
        process.stdout.write(`[${config.NODE_ENV}] ${greeting}\n`);
        return;
      }

      process.stdout.write(`${greeting}\n`);
    });
}
