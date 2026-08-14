import { createLogger } from '@carlba/logger';
import { Command } from 'commander';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { registerGreetCommand } from './greet.js';
import type { Config } from '../schema.js';

const prodConfig: Config = {
  NODE_ENV: 'production',
  isDevelopment: false,
  logLevel: 'info',
  name: undefined,
};
const devConfig: Config = {
  NODE_ENV: 'development',
  isDevelopment: true,
  logLevel: 'debug',
  name: undefined,
};
const logger = createLogger(undefined, 'test');

describe('registerGreetCommand', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('greets the provided name', async () => {
    const program = new Command();
    registerGreetCommand(program, prodConfig, logger);
    const writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    await program.parseAsync(['greet', '--name', 'Carl'], { from: 'user' });

    expect(writeSpy).toHaveBeenCalledWith('Hello, Carl!\n');
  });

  it('falls back to the default greeting when no name is given', async () => {
    const program = new Command();
    registerGreetCommand(program, prodConfig, logger);
    const writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    await program.parseAsync(['greet'], { from: 'user' });

    expect(writeSpy).toHaveBeenCalledWith('Hello, world!\n');
  });

  it('prefixes the greeting with the environment name in development', async () => {
    const program = new Command();
    registerGreetCommand(program, devConfig, logger);
    const writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    await program.parseAsync(['greet', '--name', 'Carl'], { from: 'user' });

    expect(writeSpy).toHaveBeenCalledWith('[development] Hello, Carl!\n');
  });
});
