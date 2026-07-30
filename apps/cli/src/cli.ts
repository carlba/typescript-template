#!/usr/bin/env node
import { getConfig } from '@carlba/config';
import { Command } from 'commander';

import { registerGreetCommand } from './commands/greet.js';
import { envSchema } from './schema.js';
import { createLogger } from '@carlba/logger';

const config = getConfig(envSchema);

const program = new Command();
const logger = createLogger(undefined, config.NODE_ENV, { level: config.logLevel }).child({
  name: 'typescript-template-cli',
});

program.name('cli').description('Utility CLI').version('0.0.1');

registerGreetCommand(program, config, logger);

program.parse();
