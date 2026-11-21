---
paths:
  - 'apps/backend/**'
  - 'apps/api/**'
---

# Backend / API apps — Fastify + InferDI

_Applies to a backend app built on Fastify. Also follow the common rules in the root `CLAUDE.md`
("Backend / API apps"). The `paths` above assume the app lives in `apps/backend` or `apps/api` —
add its folder if it has another name._

- Use Fastify as the HTTP framework.

- Use InferDI for dependency injection and prefer class-based services and controllers over
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

- Wire InferDI into Fastify with the official
  [`@inferdi/fastify`](https://inferdi.com/adapters/fastify) adapter rather than hand-rolled
  decoration — it manages per-request scopes automatically:

  ```bash
  pnpm add @inferdi/inferdi @inferdi/fastify
  ```

  ```ts
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

  type RootContainer = typeof root;
  type RequestContainer = ReturnType<RootContainer['createScope']>;

  declare module 'fastify' {
    interface FastifyInstance {
      di: RootContainer;
    }
    interface FastifyRequest {
      di: RequestContainer;
    }
  }
  ```

  The adapter exposes the root container as `app.di` and a request-scoped container as `request.di`;
  it creates the scope in `onRequest` and disposes it in `onResponse`, so request-scoped state stays
  isolated without manual cleanup. Resolve services from `request.di` inside route handlers rather
  than constructing them directly:

  ```ts
  app.get('/users/:id', async request => {
    const { id } = request.params as { id: string };
    return request.di.get('userService').getUser(id);
  });
  ```

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

- Register a single global error handler with `app.setErrorHandler()` rather than try/catch in each
  route. It's the only place that turns an error into an HTTP response:

  ```ts
  app.setErrorHandler((error: Error, request, reply) => {
    if (error instanceof ApiError) {
      request.log.warn({ err: error, statusCode: error.statusCode }, error.message);
      reply.status(error.statusCode).send({ error: error.message });
      return;
    }

    if ('validation' in error) {
      request.log.warn({ err: error }, 'Request validation failed');
      reply.status(400).send({ error: 'Invalid request', details: error.validation });
      return;
    }

    request.log.error({ err: error }, 'Unhandled error');
    reply.status(500).send({ error: 'Internal server error' });
  });

  app.setNotFoundHandler((request, reply) => {
    request.log.warn({ url: request.url, method: request.method }, 'Route not found');
    reply.status(404).send({ error: `Route not found: ${request.method} ${request.url}` });
  });
  ```

  Always log through `request.log` (or a `.child()` of it) rather than a bare top-level logger —
  it's pre-bound with per-request context (request id, route, method), so a log line for an error
  can be traced back to the request that caused it. Pass the error under the `err` key so pino's
  default serializer expands the stack trace instead of just `error.message`.

  Async route handlers can just `throw` — Fastify awaits the handler promise and routes any
  rejection to `setErrorHandler` automatically, so no per-route try/catch is needed. Unmatched
  routes (404s) go through `app.setNotFoundHandler()` instead, which is registered separately.
