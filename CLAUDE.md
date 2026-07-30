# Project Guidelines

## Overview

This is a **template repository**: it gets forked/copied and specialized into different kinds of
projects — CLI-only, backend-only, or fullstack (backend + frontend). It's a pnpm workspace monorepo
using ESM modules, Vitest for testing, ESLint + Prettier for code quality, and tsx for development.
`apps/*` holds executables/services and `packages/*` holds shared libraries, each with its own
`package.json`, `tsconfig.json`, and `src/`.

This file has two parts:

- **Part A** describes the repo exactly as it stands today — always applicable.
- **Part B** is conditional guidance for capabilities this template doesn't have yet (an HTTP
  backend, a web frontend, outbound HTTP calls). Follow it once that capability is actually added —
  it is not a description of current code, and its absence today doesn't mean it's discouraged.

# Part A — Current state

## Structure & dependency graph

Four workspace packages exist today, wired together via pnpm's `workspace:*` protocol:

- `apps/cli` (`@carlba/cli`) — bin app (`cli` → `dist/cli.js`), built with Commander. Depends on
  `core`, `config`, `logger`.
- `packages/core` (`@carlba/core`) — shared library, e.g. `GreetingService`. Depends on `logger`.
  Only holds code that's actually shared by more than one app — code used by a single app belongs in
  that app's own `src/`, not here.
- `packages/logger` (`@carlba/logger`) — pino wrapper. Exports `createLogger(...)` and the `Logger`
  type. No internal deps (leaf).
- `packages/config` (`@carlba/config`) — zod-based env parsing. Exports `getConfig`, `initConfig`,
  `parseConfig`. No internal deps (leaf).

Dependency graph: `cli → core, config, logger`; `core → logger`.

## Commands

Run from the repo root; they fan out across all workspace packages via pnpm:

- `pnpm run build` — compile TypeScript in every package (`pnpm -r run build`)
- `pnpm run start` / `pnpm run start:dev` — run the CLI / run it with hot reload
- `pnpm test` — run tests once across every package (`pnpm -r run test`)
- `pnpm run test:coverage` — test with coverage
- `pnpm run lint` — lint the codebase (`eslint .`, repo-wide flat config)
- `pnpm run format` / `pnpm run format:check` — format code with Prettier
- `pnpm run dependency:update` — `pnpm up -r --latest`, excluding `typescript`, `vitest`,
  `@types/node`

Use `pnpm --filter <package-name> <script>` to target a single workspace package, e.g.
`pnpm --filter @carlba/core test` or `pnpm --filter @carlba/cli build`.

## Adding a new package

- Executable or service → `apps/<name>`. Shared library consumed by other packages →
  `packages/<name>`. No registration step beyond creating the directory — `pnpm-workspace.yaml`
  already globs `apps/*` and `packages/*`.
- Only put code in `packages/*` once it's actually used by more than one app. Code used by a single
  app stays in that app's own `src/` until a second consumer appears — don't pre-extract "shared"
  packages speculatively.
- `package.json`: scope the name `@carlba/<name>`, `"type": "module"`, `"private": true`. Declare
  internal dependencies as `"@carlba/other": "workspace:*"`. Libraries need `main`/`types`/`exports`
  pointing at `dist/`; bin apps need a `bin` field instead.
- `tsconfig.json`:
  `{ "extends": "../../tsconfig.json", "compilerOptions": { "rootDir": "./src", "outDir": "./dist" }, "include": ["src"] }`.
  Libraries also set `declaration: true, declarationMap: true`.
- `vitest.config.ts`: copy the shape used by all four existing packages — `environment: 'node'`, v8
  coverage with `text`/`json`/`html` reporters, `dir: 'src'`.

## Shared packages

New apps should bootstrap config and logging through `@carlba/config` and `@carlba/logger` rather
than reading `process.env` or instantiating `pino` directly. This is the real pattern from
`apps/cli/src/cli.ts` and `apps/cli/src/schema.ts`:

```ts
// schema.ts
export const envSchema = z
  .object({
    NODE_ENV: z
      .string()
      .trim()
      .default('development')
      .pipe(z.enum(['production', 'development', 'test'])),
    LOG_LEVEL: z
      .string()
      .trim()
      .default('debug')
      .pipe(z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal'])),
  })
  .transform(raw => ({
    NODE_ENV: raw.NODE_ENV,
    isDevelopment: raw.NODE_ENV !== 'production',
    logLevel: raw.LOG_LEVEL,
  }));
```

```ts
// cli.ts
import { getConfig } from '@carlba/config';
import { createLogger } from '@carlba/logger';
import { envSchema } from './schema.js';

const config = getConfig(envSchema); // throws on invalid env
const logger = createLogger(undefined, config.NODE_ENV, { level: config.logLevel }).child({
  name: 'typescript-template-cli',
});
```

`getConfig` throws on invalid input — use it when startup should fail loudly. `initConfig` instead
logs and calls `process.exit(1)` — use it when you want a clean CLI/process exit rather than an
uncaught exception.

Services and domain logic should throw `ApiError` (`@carlba/core`, `packages/core/src/errors.ts`)
rather than plain `Error`s. Packages can inherit from `ApiError` and create more specific errors if
needed.

```ts
import { ApiError } from '@carlba/core';

throw new ApiError(`User not found: id=${userId}`, { statusCode: 404, cause: originalError });
```

- `statusCode` is loosely based on HTTP status codes since that's a well-known, well-understood
  scale — it doesn't imply the error is HTTP-specific.
- `ApiError` should be caught by global error handling (a Fastify error handler, a CLI top-level
  catch, etc.), not by the code that throws it.
- The consumer/global handler decides how to present the error to the end user — services and domain
  logic just throw with an accurate `statusCode` and message; they shouldn't format a response
  themselves.
- When throwing errors be descriptive in the error message, include a statusCode matching the
  situation. If the ApiError was caused by another error then include that error as the cause.

### Formatting `ApiError` messages

A global handler only sees the error, not the code path that led to it — the stack trace shows where
`ApiError` was constructed, but not _which_ input or entity was involved. The message is the only
situational context that survives, so it must carry the specifics:

- Include the identifying data in the message, not a generic phrase:
  `` `User not found: id=${userId}` `` rather than `'User not found'`. Prefer `key=value` pairs for
  the identifying data so messages stay greppable in logs.
- When wrapping a lower-level error (a DB error, a failed `got` request, etc.), pass it as `cause`
  rather than discarding it, so both stacks are preserved:

  ```ts
  try {
    return await db.users.findById(userId);
  } catch (dbError) {
    throw new ApiError(`Failed to load user: id=${userId}`, { statusCode: 404, cause: dbError });
  }
  ```

  Pino's default serializer includes `cause` when logging the error (see the Fastify error handler
  below), so the log shows the full chain instead of just the outer `ApiError`.

- Never put user-facing formatting in the message (no trailing punctuation styling, no HTML) — the
  consumer decides how to present it; the message is for logs and developers.

## TypeScript & code style

### Clean code principles

- Use meaningful names for variables, functions, parameters, and classes.
- Keep functions small and focused on a single responsibility.
- Extract magic numbers and strings into named constants.
- Prefer positive conditionals: `if (isValid)` instead of `if (!isInvalid)`.
- Use fewer than three parameters when possible. If more are needed, use an options object.
- Avoid duplicated logic by extracting shared helper functions.
- Comment why a decision was made, not what the code already shows.

### TypeScript rules

- Use strict TypeScript and follow the root `tsconfig.json` (extended by every package).
- Prefer `interface` for object shapes and `type` for unions, intersections, and aliases.
- Avoid `any`; use `unknown` when the type is uncertain and narrow it explicitly.
- Use `const` by default, and use `let` only when reassignment is necessary.
- Prefer explicit return types on exported functions.
- Use ESM imports and exports (`verbatimModuleSyntax` is on — include file extensions in relative
  imports, e.g. `./schema.js`).
- Prefer named exports over default exports.

### Naming conventions

| Construct              | Convention                      | Example                                 |
| ---------------------- | ------------------------------- | --------------------------------------- |
| Variables / parameters | camelCase, descriptive nouns    | `userResponse`, `retryCount`            |
| Functions              | camelCase, verb phrases         | `fetchUserProfile`, `parseErrorMessage` |
| Classes / interfaces   | PascalCase                      | `HttpClient`, `UserRepository`          |
| Constants              | UPPER_SNAKE_CASE (module-level) | `MAX_RETRY_ATTEMPTS`                    |
| Types                  | PascalCase                      | `ApiResponse`, `RequestOptions`         |
| Files                  | kebab-case                      | `user-service.ts`, `parse-response.ts`  |

## Testing

- Use Vitest and colocate test files with source files using `.spec.ts` (e.g. `greet.ts` +
  `greet.spec.ts`).
- Write behavior-focused tests, not implementation tests.
- Prefer `vi.mock` for external dependencies and avoid mocking internals.
- Cover edge cases and error paths, not just the happy path.
- Each package runs its own Vitest config — there is no aggregated root test runner beyond
  `pnpm -r run test`.

## Error handling

- Never swallow errors with empty `catch` blocks.
- Wrap third-party errors with context before rethrowing.
- Validate external inputs at system boundaries: API responses, environment variables, CLI args.

## Verification checklist

Before considering a change done:

1. `pnpm run lint`, `pnpm run test`, `pnpm run build` from root (or the `pnpm --filter <pkg> ...`
   equivalents when working in a single package).
2. Update `README.md` if the change affects documented usage or structure.

# Part B — Conditional conventions

These apply once the corresponding capability is added to the template. Follow them at that point;
their absence today isn't a signal to avoid them.

## CLI apps

_Applies to any `apps/*` package that is a command-line tool — already true for `apps/cli`, and the
template for future CLI apps._

- Use [Commander](https://www.npmjs.com/package/commander).
- The package's `bin` entry should match the project name and point to `dist/cli.js`.
- The entry file (`cli.ts`) should construct and run the `Command` program; put each subcommand in
  its own file under `src/commands/` (see `apps/cli/src/commands/greet.ts` as the template) and
  register it from the entry file.
- Include a `prepare` script that runs the package's build so `npm link`/`pnpm link` works locally.
- Bootstrap config/logging via `@carlba/config` + `@carlba/logger`, as shown above.

## HTTP client usage

_Applies whenever any package needs to make outbound HTTP calls._

- Use [`got`](https://github.com/sindresorhus/got) as the HTTP client.
- Do not use `fetch`, `axios`, or `node-fetch`.
- Prefer `got.extend()` for shared base URLs, headers, and retry logic.
- Type responses with `got<ResponseType>(url, options)`.
- Catch `HTTPError` and rethrow it with contextual information.

```ts
import got, { HTTPError } from 'got';

const apiClient = got.extend({
  prefixUrl: 'https://api.example.com',
  responseType: 'json',
});

async function fetchUser(userId: string): Promise<User> {
  try {
    return await apiClient.get<User>(`users/${userId}`).json();
  } catch (error) {
    if (error instanceof HTTPError) {
      throw new Error(`Failed to fetch user ${userId}: ${error.response.statusCode}`);
    }
    throw error;
  }
}
```

## Backend / API apps

_Applies when this template is specialized into a project with an HTTP backend — e.g. a future
`apps/api` package._

- Prefer TypeScript on Node.js for backend services.
- Use Fastify as the default HTTP framework.
- Use Inferdi for dependency injection and prefer class-based services and controllers over
  factory-function services.
- Validate routes using zod:

  ```typescript
  import fastify from 'fastify';
  import {
    ZodTypeProvider,
    serializerCompiler,
    validatorCompiler,
  } from 'fastify-type-provider-zod';

  const app = fastify().withTypeProvider<ZodTypeProvider>();
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  const exampleSchema = {
    body: z.object({
      name: z.string(),
      age: z.number(),
    }),
    response: {
      200: z.object({
        id: z.string(),
        name: z.string(),
      }),
    },
  };

  app.post('/user', { schema: exampleSchema }, async (req, reply) => {
    const { id, name } = await service.create(req.body);
    return { id, name };
    // Types are inferred from the Zod schema.
  });
  ```

- Keep route handlers thin and delegate business logic to class-based services. Resolve services
  from the InferDI container rather than constructing them manually.
- Structure services as classes with constructor injection:

  ```typescript
  import { ApiError } from '@carlba/core';

  export class UserService {
    constructor(
      private readonly userRepository: UserRepository,
      private readonly logger: Logger
    ) {}

    async getUser(id: string) {
      this.logger.info(`Fetching user ${id}`);
      const user = await this.userRepository.findById(id);
      if (!user) {
        throw new ApiError(`User not found: id=${id}`, { statusCode: 404 });
      }
      return user;
    }
  }
  ```

  Register the class and its dependencies with InferDI so the app can resolve them consistently in
  tests and runtime.

- Services and domain logic throw `ApiError` (`@carlba/core`, see Shared packages above)
- Register a single global error handler with `app.setErrorHandler()` rather than try/catch in each
  route. It's the only place that turns an error into an HTTP response:

  ```ts
  app.setErrorHandler((error, request, reply) => {
    if (error instanceof ApiError) {
      // expected error — still log it (with statusCode/route) so the occurrence is traceable,
      // just at a level below `error` since it's not a bug
      request.log.warn({ err: error, statusCode: error.statusCode }, error.message);
      reply.status(error.statusCode).send({ error: error.message });
      return;
    }

    if (error.validation) {
      // Fastify/zod schema validation failure
      request.log.warn({ err: error }, 'Request validation failed');
      reply.status(400).send({ error: 'Invalid request', details: error.validation });
      return;
    }

    // unexpected error — log full detail (pino serializes err.stack), don't leak it to the client
    request.log.error({ err: error }, 'Unhandled error');
    reply.status(500).send({ error: 'Internal server error' });
  });
  ```

  Always log through `request.log` (or a `.child()` of it) rather than a bare top-level logger —
  it's pre-bound with per-request context (request id, route, method), so a log line for an error
  can be traced back to the request that caused it. Pass the error under the `err` key so pino's
  default serializer expands the stack trace instead of just `error.message`.

  Async route handlers can just `throw` — Fastify awaits the handler promise and routes any
  rejection to `setErrorHandler` automatically, so no per-route try/catch is needed. Unmatched
  routes (404s) go through `app.setNotFoundHandler()` instead, which is registered separately.

- Do not introduce NestJS, Express, or other frameworks unless explicitly requested or already in
  use.
- Bootstrap config/logging via `@carlba/config` + `@carlba/logger`, as shown above, rather than ad
  hoc `process.env`/`pino` usage.
- Favor clear types, explicit interfaces, and predictable module boundaries.
- Optimize for maintainability, testability, and low operational complexity.

## Frontend / Web UI apps

_Applies when this template is specialized into a fullstack project with a web UI — e.g. a future
`apps/web` package._

- Use React with TypeScript as the standard for all web UI work.
- Use [shadcn/ui](https://ui.shadcn.com) as the primary component library; add components via
  `npx shadcn@latest add <component>` and own the generated source in `src/components/ui/`.
- Use Tailwind CSS utility classes for all styling; avoid plain CSS files unless Tailwind cannot
  express the style.
- Use shadcn/ui's built-in CSS variables and `tailwind.config` theme extension to define colors,
  typography, and spacing consistently; do not hardcode color values.
- Design responsive layouts using Tailwind's responsive prefixes (`sm:`, `md:`, `lg:`, etc.); every
  UI must work on mobile, tablet, and desktop.
- Do not introduce MUI, Chakra UI, Ant Design, or other component libraries unless explicitly
  requested.
- Keep components small and focused on a single responsibility; move business logic into custom
  hooks or service modules.
- Use React Router for client-side routing when navigation is required. If query params are used,
  use the [`useSearchParams`](https://reactrouter.com/api/hooks/useSearchParams) hook.
- Prefer functional components and React hooks; do not use class components.
- Lift state only as far as needed; prefer local component state or context over global state
  libraries unless the app clearly requires it.
- Follow accessible HTML patterns; shadcn/ui is built on Radix UI primitives which provide ARIA
  support — supplement with explicit labels where needed.
