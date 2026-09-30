# Insomnia API Tests

The importable Insomnia collection is [`insomnia/blog-api-insomnia.json`](../insomnia/blog-api-insomnia.json). It contains the health check, all seven API endpoints, successful requests, validation failures, authentication failures, duplicate signup, ownership checks, and post deletion.

## Import and start

1. Start the API and databases from the project root:

   ```sh
   docker compose up -d --build
   ```

2. In Insomnia, select **Import**, choose **From File**, and open `insomnia/blog-api-insomnia.json`.
3. Select the **Local Docker** environment. Its `base_url` defaults to `http://localhost:3000`.
4. Send **Health check (200)** to confirm the API is reachable.

When running the API directly with `npm run dev`, change `base_url` to `http://localhost:3333` to match the local `.env` port.

## Run the full request flow

1. Send **Sign up author (201)**. Use a new `signup_email` value if that address already exists. Copy the `token` from the response into the environment variable `auth_token`.
2. Send **Sign up second user (201)**. Copy its response `token` into `other_token`. This separate account is used to exercise the ownership rules.
3. Send **Create post (201)** using `auth_token`. Copy the response `id` into the environment variable `post_id`.
4. Send **List posts (200)** and **Get post by ID (200)** to verify the public read routes.
5. Send **Update own post (200)** to verify partial updates.
6. Send **Update someone else's post (403)** and **Delete someone else's post (403)** while `post_id` points to the first user's post and `other_token` belongs to the second user.
7. Send **Create post without token (401)**, **List posts invalid page (400)**, **Get post invalid UUID (400)**, **Update post with empty body (400)**, **Sign up duplicate email (409)**, and **Sign in wrong password (401)** to exercise expected error responses.
8. Send **Delete own post (204)** using `auth_token`, then **Get deleted post (404)**.

The expected status is included in each request name and description. Insomnia stores environment edits locally; keep the token values in the private environment and do not share them.

## Repeating tests

Signup emails persist in PostgreSQL. For a fresh signup test, change `signup_email` and `other_email` to unused addresses. Alternatively, sign in with an existing account and replace `auth_token` with the newly returned token. A successful sign-in replaces that user's previous session token, so only the most recently issued token remains valid.
