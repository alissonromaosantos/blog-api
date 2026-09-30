# Blog API

REST API for user authentication and blog post management, built with TypeScript, Express 5, Zod, Drizzle ORM, and PostgreSQL 17.

## Local setup

1. Install Node.js 24 or later and Docker Compose.
2. Copy `.env-sample` to `.env` and fill in the required values.
3. Start both PostgreSQL databases and the API:

```sh
docker compose up --build
```

The API is available at `http://localhost:3000`; `GET /health` is its health check. Compose keeps application and test databases in separate containers and volumes.

For local development outside Docker, start PostgreSQL, install packages with `npm ci`, apply migrations with `npm run db:migrate`, and run `npm run dev`.

Run `npm run format` to format source/configuration files, `npm run format:check` to verify formatting, and `npm run lint` to check code quality.

## Tests

Integration tests use the real PostgreSQL test database, not a mocked repository. Configure `TEST_DATABASE_URL` in `.env`, make sure that database is running, then run:

```sh
npm test
```

The test suite applies migrations and clears test data between cases. Never point `TEST_DATABASE_URL` at a production database.

## API

- `POST /api/auth/signup`
- `POST /api/auth/signin`
- `GET /api/posts?page=1`
- `GET /api/posts/:id`
- `POST /api/posts` (Bearer token required)
- `PUT /api/posts/:id` (Bearer token required)
- `DELETE /api/posts/:id` (Bearer token required)

All request, response, validation, and error details are specified in [`docs/api.md`](docs/api.md). Session tokens are random bearer credentials; only their SHA-256 hashes are stored in the database.

An importable Insomnia collection with requests for all endpoints and error cases is available at [`insomnia/blog-api-insomnia.json`](insomnia/blog-api-insomnia.json). See [`docs/insomnia-testing.md`](docs/insomnia-testing.md) for the import steps and request sequence.

## Database migrations

Update `src/infrastructure/database/schema.ts`, generate a migration with `npm run db:generate`, and apply it with `npm run db:migrate`. Production containers run compiled migrations before starting the HTTP server.
