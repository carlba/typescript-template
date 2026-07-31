# Project Guidelines

## Overview

This is a pnpm workspace monorepo using ESM modules, Vitest for testing, ESLint + Prettier for code
quality, and tsx for development. Apps live under `apps/*` and shared libraries under `packages/*`,
each with its own `package.json`, `tsconfig.json`, and `src/`.

## Commands

Run from the repo root; they fan out across all workspace packages via pnpm:

- `pnpm run build` — compile TypeScript in every package

- `pnpm run start:dev` — start the CLI with hot reload

- `pnpm test` — run tests once across every package

- `pnpm run test:coverage` — test with coverage

- `pnpm run lint` — lint the codebase

- `pnpm run format` — format code with Prettier

Use `pnpm --filter <package-name> <script>` to target a single workspace package (e.g.
`pnpm --filter @carlba/cli build`).

## Code Style

### Clean code principles

- Use meaningful names for variables, functions, parameters, and classes.

- Keep functions small and focused on a single responsibility.

- Extract magic numbers and strings into named constants.

- Prefer positive conditionals: `if (isValid)` instead of `if (!isInvalid)`.

- Use fewer than three parameters when possible. If more are needed, use an options object.

- Avoid duplicated logic by extracting shared helper functions.

- Comment why a decision was made, not what the code already shows.

## Mandatory checklist

Before considering a change done:

1. `pnpm run lint`, `pnpm run test`, `pnpm run build` from root (or the `pnpm --filter <pkg> ...`
   equivalents when working in a single package).

2. Update `README.md` if the change affects documented usage or structure.

Fix any failures and rerun before completing the task.

## TypeScript rules

- Use strict TypeScript and follow `tsconfig.json`.

- Prefer `interface` for object shapes and `type` for unions, intersections, and aliases.

- Avoid `any`; use `unknown` when the type is uncertain and narrow it explicitly.

- Use `const` by default, and use `let` only when reassignment is necessary.

- Prefer explicit return types on exported functions.

- Use ESM imports and exports.

- Prefer named exports over default exports.

## Naming conventions

| Construct              | Convention                      | Example                                 |
| ---------------------- | ------------------------------- | --------------------------------------- |
| Variables / parameters | camelCase, descriptive nouns    | `userResponse`, `retryCount`            |
| Functions              | camelCase, verb phrases         | `fetchUserProfile`, `parseErrorMessage` |
| Classes / interfaces   | PascalCase                      | `HttpClient`, `UserRepository`          |
| Constants              | UPPER_SNAKE_CASE (module-level) | `MAX_RETRY_ATTEMPTS`                    |
| Types                  | PascalCase                      | `ApiResponse`, `RequestOptions`         |
| Files                  | kebab-case                      | `user-service.ts`, `parse-response.ts`  |

## Project conventions

- Keep each package's/app's source code in its own `src/` (e.g. `apps/cli/src`,
  `packages/core/src`).

- Prefer early returns to reduce nesting.

## HTTP requests

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

## CLI tools

- Use [Commander](https://www.npmjs.com/package/commander).

- The package entry point should match the project name and point to `dist/cli.js`.

- `cli.js` should construct and run the CLI.

- Include a `prepare` script that runs `npm run build` so local `npm link` works.

## Error handling

- Never swallow errors with empty `catch` blocks.

- Wrap third-party errors with context before rethrowing.

- Validate external inputs at system boundaries: API responses, environment variables, CLI args.

## Environment variables

- Prefer Node’s built-in `--env-file` when running Node directly.

- In production, inject environment variables from the hosting platform.

- Access `process.env` only through a validated config module.

- Fail fast if a required environment variable is missing.

## Testing

- Use Vitest and colocate test files with source files using `.spec.ts`.

- Write behavior-focused tests, not implementation tests.

- Prefer `vi.mock` for external dependencies and avoid mocking internals.

- Cover edge cases and error paths, not just the happy path.

## Backend

- Prefer TypeScript on Node.js for backend services.

- Use Fastify as the default HTTP framework.

- Use InferDI for dependency injection and prefer class-based services and controllers over
  factory-function services.

- Validate routes using zod, like so

  ```typescript
  import fastify from 'fastify';
  import { ZodTypeProvider } from 'fastify-type-provider-zod';
  import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod';
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

- Use `ApiError` (`@carlba/core`, `packages/core/src/errors.ts`) for exception handling instead of
  plain `Error`s or a hand-rolled `HttpError`. `statusCode` is loosely based on HTTP status codes;
  pass the original error as `cause` when wrapping a lower-level failure. See the "Shared packages"
  section for the full pattern.

- Keep architecture simple and modular; avoid heavy abstractions unless clearly required.

- Write small, focused route handlers and move business logic into class-based services.

- Wire InferDI into Fastify with the official [`@inferdi/fastify`](https://inferdi.com/adapters/fastify)
  adapter rather than hand-rolled container decoration — it manages per-request scopes automatically:

  ```bash
  pnpm add @inferdi/inferdi @inferdi/fastify
  ```

  ```typescript
  import Fastify from 'fastify';
  import { inferdiFastify } from '@inferdi/fastify';

  const root = buildRootContainer(); // registers services/dependencies once at startup
  const app = Fastify();

  await app.register(inferdiFastify, {
    container: root,
    setupScope: (scope, request) => {
      const ctx = scope.get('request');
      ctx.requestId = request.id;
    },
  });

  app.get('/users/:id', async request => {
    const { id } = request.params as { id: string };
    return request.di.get('userService').getUser(id);
  });
  ```

- Resolve services from the request-scoped `request.di` container and inject dependencies through
  constructor injection rather than instantiating them manually.

- Services should throw `ApiError` with an accurate `statusCode`; a global error handler (see below)
  converts it into the HTTP response.

- If a service is not related to request processing at all then custom service-specific errors
  should be used.

- Register a single global error handler with `app.setErrorHandler()` rather than try/catch in each
  route:

  ```typescript
  app.setErrorHandler((error, request, reply) => {
    if (error instanceof ApiError) {
      request.log.warn({ err: error, statusCode: error.statusCode }, error.message);
      reply.status(error.statusCode).send({ error: error.message });
      return;
    }

    if (error.validation) {
      request.log.warn({ err: error }, 'Request validation failed');
      reply.status(400).send({ error: 'Invalid request', details: error.validation });
      return;
    }

    request.log.error({ err: error }, 'Unhandled error');
    reply.status(500).send({ error: 'Internal server error' });
  });
  ```

- Do not introduce NestJS, Express, or other frameworks unless explicitly requested or already in
  use.

- Favor clear types, explicit interfaces, and predictable module boundaries.

- Optimize for maintainability, testability, and low operational complexity.

## Frontend & Web UI

- Use React with TypeScript as the standard for all web UI work.

- Use [shadcn/ui](https://ui.shadcn.com) as the primary component library; add components via
  `npx shadcn@latest add <component>` and own the generated source in `src/components/ui/`.

- Use Tailwind CSS utility classes for all styling; avoid plain CSS files unless Tailwind cannot
  express the style.

- Use shadcn/ui's built-in CSS variables and `tailwind.config` theme extension to define colors,
  typography, and spacing consistently across the app; do not hardcode color values.

- Design responsive layouts using Tailwind's responsive prefixes (`sm:`, `md:`, `lg:`, etc.); every
  UI must work on mobile, tablet, and desktop.

- Do not introduce MUI, Chakra UI, Ant Design, or other component libraries unless explicitly
  requested.

- Keep components small and focused on a single responsibility; move business logic into custom
  hooks or service modules.

- Use React Router for client-side routing when navigation is required.

  - If query params are utilized use the hook https://reactrouter.com/api/hooks/useSearchParams

- Prefer functional components and React hooks; do not use class components.

- Lift state only as far as needed; prefer local component state or context over global state
  libraries unless the app clearly requires it.

- Follow accessible HTML patterns; shadcn/ui is built on Radix UI primitives which provide ARIA
  support — supplement with explicit labels where needed.
