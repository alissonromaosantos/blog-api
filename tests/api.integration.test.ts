import "dotenv/config";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import pino from "pino";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { createApp } from "../src/app";
import { loadEnv } from "../src/config/env";
import { createDatabase } from "../src/infrastructure/database/connection";
import { posts, users } from "../src/infrastructure/database/schema";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
if (!testDatabaseUrl) throw new Error("TEST_DATABASE_URL is required to run integration tests");

const env = loadEnv({
  ...process.env,
  NODE_ENV: "test",
  DATABASE_URL: testDatabaseUrl,
  TEST_DATABASE_URL: testDatabaseUrl,
});
const { db, pool } = createDatabase(testDatabaseUrl);
const app = createApp({ env, database: db, logger: pino({ level: "silent" }) });

async function clearDatabase(): Promise<void> {
  await db.delete(posts);
  await db.delete(users);
}

async function signUp(name: string, email: string) {
  const response = await request(app)
    .post("/api/auth/signup")
    .send({ name, email, password: "secret123" });
  expect(response.status).toBe(201);
  return response.body as {
    token: string;
    user: { id: string; name: string; email: string };
  };
}

describe("Blog API integration", () => {
  beforeAll(async () => {
    await migrate(db, { migrationsFolder: "./src/drizzle" });
  });

  beforeEach(clearDatabase);

  afterAll(async () => {
    await pool.end();
  });

  it("creates users, hides password hashes, and rejects duplicate email addresses", async () => {
    const result = await signUp("Writer", "WRITER@example.com");
    expect(result.user.email).toBe("writer@example.com");
    expect(result.token).toBeTruthy();
    expect(JSON.stringify(result)).not.toContain("password");

    const duplicate = await request(app).post("/api/auth/signup").send({
      name: "Another Writer",
      email: "writer@example.com",
      password: "secret123",
    });
    expect(duplicate.status).toBe(409);
    expect(duplicate.body.error.message).toBe("Email already registered");
  });

  it("validates request bodies before running authentication use cases", async () => {
    const response = await request(app)
      .post("/api/auth/signup")
      .send({ name: "", email: "not-an-email", password: "123" });
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
    expect(response.body.error.details.length).toBeGreaterThan(0);
  });

  it("signs in with case-normalized email and returns a new session token", async () => {
    const account = await signUp("Writer", "writer@example.com");
    const response = await request(app)
      .post("/api/auth/signin")
      .send({ email: "WRITER@example.com", password: "secret123" });
    expect(response.status).toBe(200);
    expect(response.body.user.id).toBe(account.user.id);
    expect(response.body.token).not.toBe(account.token);

    const invalid = await request(app)
      .post("/api/auth/signin")
      .send({ email: "writer@example.com", password: "wrongpass" });
    expect(invalid.status).toBe(401);
    expect(invalid.body.error.message).toBe("Invalid email or password");
  });

  it("creates and lists public posts with UUIDs, author names, and pagination metadata", async () => {
    const account = await signUp("Writer", "writer@example.com");
    const created = await request(app)
      .post("/api/posts")
      .set("Authorization", `Bearer ${account.token}`)
      .send({ title: "First post", content: "Post content" });
    expect(created.status).toBe(201);
    expect(created.body.author.name).toBe("Writer");
    expect(created.body.id).toMatch(/^[0-9a-f-]{36}$/i);

    const list = await request(app).get("/api/posts?page=1");
    expect(list.status).toBe(200);
    expect(list.body.data).toHaveLength(1);
    expect(list.body.meta).toEqual({
      page: 1,
      limit: 10,
      total: 1,
      totalPages: 1,
    });

    const invalidPage = await request(app).get("/api/posts?page=0");
    expect(invalidPage.status).toBe(400);
  });

  it("enforces ownership for updates and deletes, and returns 404 after deletion", async () => {
    const author = await signUp("Author", "author@example.com");
    const other = await signUp("Other", "other@example.com");
    const created = await request(app)
      .post("/api/posts")
      .set("Authorization", `Bearer ${author.token}`)
      .send({ title: "Owned post", content: "Content" });
    const postId = created.body.id as string;

    const forbiddenUpdate = await request(app)
      .put(`/api/posts/${postId}`)
      .set("Authorization", `Bearer ${other.token}`)
      .send({ title: "Changed" });
    expect(forbiddenUpdate.status).toBe(403);
    const forbiddenDelete = await request(app)
      .delete(`/api/posts/${postId}`)
      .set("Authorization", `Bearer ${other.token}`);
    expect(forbiddenDelete.status).toBe(403);

    const updated = await request(app)
      .put(`/api/posts/${postId}`)
      .set("Authorization", `Bearer ${author.token}`)
      .send({ title: "Updated title" });
    expect(updated.status).toBe(200);
    expect(updated.body.title).toBe("Updated title");

    const deleted = await request(app)
      .delete(`/api/posts/${postId}`)
      .set("Authorization", `Bearer ${author.token}`);
    expect(deleted.status).toBe(204);
    expect((await request(app).get(`/api/posts/${postId}`)).status).toBe(404);
  });

  it("rejects missing authentication and malformed UUIDs", async () => {
    const unauthorized = await request(app)
      .post("/api/posts")
      .send({ title: "Post", content: "Content" });
    expect(unauthorized.status).toBe(401);
    const invalidId = await request(app).get("/api/posts/not-a-uuid");
    expect(invalidId.status).toBe(400);
  });
});
