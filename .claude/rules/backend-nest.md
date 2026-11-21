---
paths:
  - 'apps/backend/**'
  - 'apps/api/**'
---

# Backend / API apps — NestJS

_Applies to a backend app built on NestJS. Also follow the common rules in the root `CLAUDE.md`
("Backend / API apps"). The `paths` above assume the app lives in `apps/backend` or `apps/api` —
add its folder if it has another name._

- Nest is usually newer than training data. Follow the official Nest agent skills (installed and
  updated with `npx @nestjs/skills add --agent all`) and the app's `AGENTS.md` for how to write Nest
  code. This file only adds this repo's conventions on top of them.

- Scaffold and extend with the Nest CLI (`nest new`, `nest g ...`) rather than hand-creating modules,
  controllers, and services.

- Use Nest's own DI container with class-based providers and constructor injection. Do not use
  InferDI in a Nest app.

- Use `@nestjs/config` (`ConfigModule`/`ConfigService`) for environment variables and `nestjs-pino`
  for logging. Do not use `@carlba/config` or `@carlba/logger` in a Nest app, and do not read
  `process.env` directly. Validate the environment with a zod schema passed as `validationSchema`.
  The log level comes from `LOG_LEVEL` in that schema.

- Services throw `ApiError`. Import `ExceptionFilterModule` from `@carlba/nest-modules`; it
  registers the one global exception filter (`@Catch()`, via `APP_FILTER`) that turns `ApiError`,
  validation errors, and unknown errors into HTTP responses. Controllers and services do not catch
  and format errors themselves.

- Validate request input with `class-validator` DTOs through Nest's `ValidationPipe`, registered
  once through `APP_PIPE` in `AppModule`. Do not validate inline in controllers or services.

## Target state

What a correctly set up Nest backend looks like in this monorepo. The sections below describe the
end state, not a procedure. To set up or repair an app, compare it with each section, change only
what differs, and leave everything that already matches alone.

Rules for reaching the target state:

- **Look before you write.** Check what exists first (`git ls-files apps packages`,
  `ls packages`). Never create a file or package that already exists. If `git status` shows a path
  as _modified_ rather than _untracked_, you are overwriting committed work: stop and use the
  existing file.

- **Keep to the target.** Change only what a section below says differs. Format with
  `pnpm --filter @carlba/backend run format`, not the root `pnpm run format`, which reformats
  unrelated files.

- **Verify at the end.** Run `pnpm install` at the root, then `pnpm run lint`, `pnpm run test`,
  `pnpm run build` and `pnpm --filter @carlba/backend run test:e2e`. All of them pass.

### 1. The app

- `apps/backend` is a Nest project created with the Nest CLI, as an ESM project (`"type": "module"`,
  `module: nodenext`), tested with Vitest and linted with oxlint. It has no nested git repo and no
  per-app lockfile; the one lockfile is at the repo root.

- The Nest agent skills are installed inside the app, in `apps/backend/.claude/skills` and
  `apps/backend/.agents/skills`, so they are registered when working under `apps/backend`.

- If the app does not exist yet, create it from the repo root with the pinned CLI version, so the
  generated files don't change underneath us when a new release lands, and run the skills command
  from inside the app (run from `apps/` it installs the skills next to the app instead of inside
  it). Choose to add all skills, an ESM project, and not NestJS Observe:

  ```bash
  cd apps
  pnpm dlx @nestjs/cli@12.0.15 new backend --skip-git --skip-install
  cd backend
  pnpm dlx @nestjs/skills add --agent all
  cd ../..
  ```

### 2. Workspace member

- `apps/backend/package.json` is named `@carlba/backend` and has a description.

- The devDependencies are the ones the Nest CLI generated (`typescript`, `vitest`, `oxlint`,
  `prettier`, ...), so the app stays on what Nest recommends. Review them against the root versions
  if `pnpm install` reports duplicate or mismatched versions.

- `@carlba/core` (for `ApiError`) and `@carlba/nest-modules` (see step 6) are `workspace:*`
  dependencies. `@carlba/config` and `@carlba/logger` are not used (see steps 4 and 5).

- The generated `format` script is kept.

### 3. Tooling matches the repo

- **tsconfig:** `apps/backend/tsconfig.json` extends `../../tsconfig.json` and keeps only the
  options Nest needs: `experimentalDecorators`, `emitDecoratorMetadata`,
  `strictPropertyInitialization: false`, `declaration`, `removeComments`, `incremental`,
  `outDir`/`rootDir`, and `types: ["vitest/globals", "node"]`. `module`, `moduleResolution`,
  `target`, `strict` and `esModuleInterop` come from the root (`@tsconfig/node24`).
  `tsconfig.build.json` is the generated one; `nest build` uses it.

- **`verbatimModuleSyntax`:** the root enables it, so types are imported with `import type`,
  including `INestApplication`, `App` and `TestingModule` in the tests. Classes used as DI tokens or
  in decorated constructor parameters (and DTO classes) are regular imports, since
  `emitDecoratorMetadata` needs the runtime value.

- **Prettier:** there is no `apps/backend/.prettierrc`, so the root config applies
  (`printWidth: 100`, `trailingComma: es5`), and the sources are formatted with it.

- **oxlint:** `typescript/no-floating-promises` is set in the root `.oxlintrc.json`, so it applies
  to the whole repo. `no-explicit-any` is not turned off, since the repo avoids `any`.

  Nest-specific rules live in `apps/backend/.oxlintrc.json`, which `extends` the root config
  (`"extends": ["../../.oxlintrc.json"]`) — a nested oxlint config does not inherit from the root
  unless it extends it. It sets only
  `typescript/no-extraneous-class: ["warn", { "allowWithDecorator": true }]`, because Nest modules
  such as `AppModule` are empty classes that carry only the `@Module(...)` decorator and would
  otherwise warn. Put any further Nest-only lint rules there, not in the root config.

- **Vitest:** `vitest.config.ts` has the repo's v8 coverage block (`text`, `json`, `html`
  reporters), `globals: true` and `include: **/*.spec.ts`. The separate `vitest.config.e2e.ts` runs
  the e2e tests: they live in `test/`, outside `src/`, so the other packages' `dir: 'src'` doesn't
  fit.

- **No `process.env`:** the root `node/no-process-env` rule rejects it, so `src/main.ts` reads the
  port from `ConfigService` (step 4).

### 4. Config with `@nestjs/config`

The app uses Nest's own config module rather than `@carlba/config`, so `@carlba/config` and
`@carlba/logger` are not dependencies of `apps/backend`.

- **Dependencies:** `@nestjs/config` and `zod` are in `apps/backend/package.json`.

- **Schema:** `src/config/env.schema.ts` exports a zod `envSchema` (`NODE_ENV`, `PORT`, `LOG_LEVEL`) and the
  inferred `Env` type. `PORT` uses `z.coerce.number()` because environment variables are strings.

- **Module:** `AppModule` registers
  `ConfigModule.forRoot({ isGlobal: true, envFilePath: '../../.env', validationSchema: envSchema })`.
  Nest does not read `.env` on its own — `@nestjs/config` does, from the working directory by
  default. `../../.env` points at the repo-root `.env` (pnpm runs package scripts from
  `apps/backend`), the same file the CLI loads. A variable already set in the shell wins over the
  file. Invalid variables abort bootstrap with every error listed.

- **Reading values:** `main.ts` gets `ConfigService<Env, true>` from the app and calls
  `get('PORT', { infer: true })`, which is typed as `number`. This replaces `process.env.PORT` and
  satisfies the lint rule from step 3. Providers inject `ConfigService<Env, true>` the same way.

- **Tests:** `src/config/env.schema.spec.ts` covers defaults, coercion and rejection of bad values.

- **Check:** with `PORT=3456` in the root `.env`, `pnpm --filter @carlba/backend start` listens on
  3456.

### 5. Logging with `nestjs-pino`

Logging uses [`nestjs-pino`](https://github.com/iamolegga/nestjs-pino), the Pino integration for
Nest. It is the upstream project; `pino-nestjs` is a fork whose peer dependencies stop at Nest 11,
so do not use that one with this Nest 12 app. Classes keep using Nest's `Logger`; only the backend
behind it changes.

- **Dependencies:** `nestjs-pino`, `pino` and `pino-http` in `dependencies`, `pino-pretty` in
  `devDependencies` (it is only used for development output).

- **Module:** `AppModule` imports `LoggerModule.forRootAsync(...)`. The factory injects
  `ConfigService<Env, true>` (`ConfigModule` is global) and passes the values to
  `createLoggerParams` (`src/logging/logger-params.ts`, unit-tested in `logger-params.spec.ts`),
  which builds the `nestjs-pino` options. Change logging options there, not in `AppModule`:

  ```ts
  // src/logging/logger-params.ts
  import type { Params } from 'nestjs-pino';
  import type { Env } from '../config/env.schema.js';

  // Levels at which request headers are logged. Above these, `req.headers` is removed from every
  // line: headers are bulky and can carry credentials, so they are only worth it while debugging.
  const HEADER_LOG_LEVELS: readonly Env['LOG_LEVEL'][] = ['trace', 'debug'];

  export function createLoggerParams({
    NODE_ENV,
    LOG_LEVEL,
  }: Pick<Env, 'NODE_ENV' | 'LOG_LEVEL'>): Params {
    const isProduction = NODE_ENV === 'production';
    const showHeaders = HEADER_LOG_LEVELS.includes(LOG_LEVEL);

    return {
      // pino-pretty prints a log's `name` field in parentheses, `INFO (AppService): ...`, so the Nest
      // context is renamed to `name` in development. Production JSON keeps `context`.
      renameContext: isProduction ? undefined : 'name',
      pinoHttp: {
        level: LOG_LEVEL,
        redact: showHeaders ? undefined : { paths: ['req.headers'], remove: true },
        // Human-readable output while developing, plain JSON lines in production. pino-pretty is a
        // dev-only transport and not loaded in production.
        transport: isProduction
          ? undefined
          : { target: 'pino-pretty', options: { ignore: 'pid,hostname' } },
      },
    };
  }
  ```

  And `AppModule` wires it to the config:

  ```ts
  LoggerModule.forRootAsync({
    // ConfigModule is global, so ConfigService can be injected without importing it here.
    inject: [ConfigService],
    useFactory: (configService: ConfigService<Env, true>) =>
      createLoggerParams({
        NODE_ENV: configService.get('NODE_ENV', { infer: true }),
        LOG_LEVEL: configService.get('LOG_LEVEL', { infer: true }),
      }),
  }),
  ```

  What each option does:

  - `level` is `LOG_LEVEL` from the zod schema. Pino's level names are `trace`, `debug`, `info`,
    `warn`, `error`, `fatal`. Neither `nestjs-pino` nor `pino` reads `NEST_LOG_LEVEL` (that is a
    Nest `ConsoleLogger` feature), so the level is only configured here. Default `debug`, the same
    variable and default as the CLI.

  - `transport` is `{ target: 'pino-pretty', options: { ignore: 'pid,hostname' } }` unless
    `NODE_ENV` is `production`, where output stays plain JSON lines for a log collector. The pid and
    hostname are hidden in the pretty output; remove them from `ignore` to show them again (the
    JSON output always includes both).

  - `redact: { paths: ['req.headers'], remove: true }` when `LOG_LEVEL` is above `debug` (`info`,
    `warn`, `error`, `fatal`). Request headers are only logged at `trace` and `debug`, since they
    are bulky and can carry credentials. The `res` object's headers are not touched.

  - `renameContext: 'name'` outside production. `pino-pretty` prints a log's `name` field in
    parentheses, so lines read `INFO (AppService): Handling getHello` instead of showing the
    context as a separate field. In production the field stays `context` in the JSON.

- **Installing it:** providing the module does not make Nest use it. `main.ts` creates the app with
  `bufferLogs: true`, so Nest's startup logs are held, then calls
  `app.useLogger(app.get(Logger))` with `Logger` from `nestjs-pino`, which flushes them through
  pino.

- **Level mapping:** Nest's methods map onto pino levels: `verbose` is `trace`, `debug` is `debug`,
  `log` is `info`, `warn`, `error` and `fatal` are unchanged. `new Logger(...).log(...)` therefore
  works unchanged and is written at `info`. `LOG_LEVEL` uses pino's names, so `log` is not a valid
  value.

- **In providers:** keep creating one logger per class with the class name as context,
  `private readonly logger = new Logger(AppService.name);` (`Logger` from `@nestjs/common`). The
  class name appears as the `context` field. See `src/app.service.ts`. Classes do not inject the
  logger, so unit tests need no logger setup.

- **Structured data goes first:** `this.logger.log({ orderId, amount }, 'Payment captured')`. The
  object is merged into the log line as fields. The Nest-style `log('Payment captured', { orderId })`
  silently drops the object when pino is the backend, so do not write it that way.

- **Request context:** `pino-http` adds a `req` object (id, method, url, and headers at `debug` and
  below) to every line logged while handling a request, and writes a `request completed` line per
  request. This is what makes lines from one request traceable. Tune it through `pinoHttp` options
  (`autoLogging`, `redact`, `serializers`) in `createLoggerParams` if it becomes noisy. At `debug`
  and below, redact `req.headers.authorization` and cookies before logging real traffic.

- **Outside providers:** `main.ts` uses the `Logger` from `nestjs-pino` directly for the startup
  line: `logger.log('Listening on port ...', 'Bootstrap')` (message, then context).

- **Errors:** the global exception filter (step 6) is the one place that logs errors thrown as
  `ApiError` or unexpected errors; services do not log and rethrow. To log an error yourself, put the
  error under the `err` key, `this.logger.error({ err: error, orderId }, 'Payment failed')`, so pino
  expands the stack and the `cause` chain.

### 6. Global exception filter

Services throw `ApiError` (`@carlba/core`); one filter turns every error into an HTTP response and
logs it. Controllers and services do not catch and format errors themselves.

The filter is part of the template, in the committed package `packages/nest-modules`. The app's side
of the target state is only the dependencies and the import below. The package, filter and specs are
not created or rewritten when setting up an app; change them only when asked to, by editing the
existing files and extending their specs.

- **Package:** the filter lives in `packages/nest-modules` (`@carlba/nest-modules`) as a Nest
  module, so other Nest apps can reuse it. `nest-modules` is the one package for all shared Nest
  modules (one folder per module under `src/`, re-exported from `src/index.ts`) rather than one
  package per module, to keep maintenance down. It is a package even though the backend is its only
  consumer today, because it was requested explicitly; that is an exception to the "only extract
  once a second app uses it" rule in the root `CLAUDE.md`. It follows the standard package
  shape plus `experimentalDecorators` and `emitDecoratorMetadata` in its `tsconfig.json`, and
  `@nestjs/common` and `@nestjs/core` as peer dependencies so the app and the package share one copy.

- **Dependencies:** `apps/backend/package.json` lists `@carlba/nest-modules` and `@carlba/core` as
  `workspace:*`; the app needs `@carlba/core` itself for `ApiError`. Both are built before the app
  (`pnpm run build` does, in dependency order) and resolve to their `dist/`.

- **Module:** `ExceptionFilterModule` declares `{ provide: APP_FILTER, useClass: AllExceptionsFilter }`.
  A provider with `APP_FILTER` is global wherever its module is imported, so `AppModule` only lists
  `ExceptionFilterModule` in `imports`. `AllExceptionsFilter` is exported too, for apps that want to
  register it themselves.

- **Filter:** `AllExceptionsFilter` is a `@Catch()` class. It uses `HttpAdapterHost` to reply, not
  `@Res()`, so it does not depend on Express or Fastify. It handles three cases:

  - `ApiError`: responds with `exception.statusCode` and `{ statusCode, message }`.

  - Nest's `HttpException` (an unknown route, and later the validation pipe): keeps the status and
    the body Nest built, so details such as validation issues reach the client.

  - Anything else, including a thrown non-`Error`: `500` with `Internal server error`.

- **Client message:** for any status of 500 or above the message is replaced by
  `Internal server error`, even for an `ApiError`. The real message (which carries identifying data,
  see "Formatting `ApiError` messages" in the root `CLAUDE.md`) only goes to the log.

- **Logging:** `warn` for 4xx and `error` for 5xx, as
  `this.logger.error({ err: exception, statusCode }, message)`. `err` makes pino serialize the stack
  and the `cause` chain, so an `ApiError` that wraps a database error logs both. The `req` object
  from `pino-http` is on the line already, so the request id is there without extra work. The
  object-first call shape assumes `nestjs-pino` is the app's logger (see step 5).

### 7. Request validation with `class-validator`

Request bodies are DTO classes decorated with `class-validator` rules, checked by one global
`ValidationPipe`. Invalid input never reaches the controller: the pipe throws a
`BadRequestException`, and the exception filter (step 6) sends its body to the client unchanged.

- **Dependencies:** `class-validator` and `class-transformer` in `apps/backend/package.json`
  (`ValidationPipe` loads both). Named imports work from native ESM.

- **DTO:** `src/demo/echo.dto.ts`. Use a class, not an interface, since the pipe needs the runtime
  type through `emitDecoratorMetadata`. Import it as a value in the controller, not with
  `import type`.

  ```ts
  export class EchoDto {
    @IsString()
    @Length(1, 200)
    message: string;
  }
  ```

- **Pipe:** registered in `AppModule` as `{ provide: APP_PIPE, useValue: new ValidationPipe({...}) }`
  rather than `app.useGlobalPipes()` in `main.ts`, because the e2e tests build the app from
  `AppModule` and would otherwise skip validation. Options:

  - `whitelist` and `forbidNonWhitelisted`: unknown properties answer 400 instead of being passed
    on, so a body spread into an entity cannot set fields the DTO does not declare.

  - `transform`: the handler receives a DTO instance, and primitive path and query params are
    converted to their declared types.

- **Optional fields:** do not use `@IsOptional()`. It skips every rule for `null` as well as
  `undefined`, so `{"title": null}` gets through. Use
  `@ValidateIf((_, value) => value !== undefined)` in front of the other rules. Nested objects need
  `@ValidateNested()` together with `@Type(() => Nested)` from `class-transformer`; without `@Type()`
  the nested rules are skipped.

- **Demo route:** `POST /demo/echo` returns the validated body. Remove it with `EchoDto` once real
  endpoints exist.

  ```bash
  curl -i -X POST localhost:3000/demo/echo -H 'content-type: application/json' -d '{"message":"hi"}'
  # 201 {"message":"hi"}
  curl -i -X POST localhost:3000/demo/echo -H 'content-type: application/json' -d '{"message":42}'
  # 400 {"message":["message must be a string","message must be longer than or equal to 1 and shorter than or equal to 200 characters"],"error":"Bad Request","statusCode":400}
  curl -i -X POST localhost:3000/demo/echo -H 'content-type: application/json' -d '{"message":"hi","role":"admin"}'
  # 400 {"message":["property role should not exist"],"error":"Bad Request","statusCode":400}
  ```

- **Tests:** the e2e tests in `test/app.e2e-spec.ts` cover a valid body, a wrong type, a missing
  field and an unknown property. The 400 body for an invalid request is the one Nest builds, so
  assert on the status and on `arrayContaining` for the messages rather than the whole array.

### 8. httpYac requests

The root `CLAUDE.md` asks every backend for an [httpYac](https://httpyac.github.io) `.http` file.
`apps/backend/requests.http` has one request per endpoint, including the failing demo routes, so the
exception filter and the validation pipe can be tried from the editor.

- **Layout:** one request per `###` block, with the expected status in the title. `@baseUrl` is
  defined once at the top; it is the default `PORT` (3000) from `src/config/env.schema.ts`, so change
  it there if `.env` sets another port.

- **Maintenance:** add a request here with every new endpoint, and delete the demo requests together
  with the demo routes. There are no secrets in the file yet; once an endpoint needs a token, read it
  with `{{$dotenv APP_TOKEN}}` as in the root `CLAUDE.md` rather than writing it into the file.

