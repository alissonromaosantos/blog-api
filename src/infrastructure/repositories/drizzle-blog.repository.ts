import { count, desc, eq } from "drizzle-orm";
import type { Database } from "../database/connection.js";
import { posts, users } from "../database/schema.js";
import type { AuthRepository } from "../../modules/auth/repositories/auth.repository.js";
import type { AuthenticatedUserDto, SafeUserDto } from "../../modules/auth/dtos/auth.dto.js";
import type { PostRecord } from "../../modules/posts/dtos/post.dto.js";
import type { PostRepository } from "../../modules/posts/repositories/post.repository.js";

export class DrizzleBlogRepository implements AuthRepository, PostRepository {
  constructor(private readonly database: Database) {}

  async findUserByEmail(email: string) {
    const [user] = await this.database.select().from(users).where(eq(users.email, email)).limit(1);
    if (!user) return null;
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      passwordHash: user.password,
    };
  }

  async createUser(input: {
    name: string;
    email: string;
    passwordHash: string;
    tokenHash: string;
  }): Promise<SafeUserDto> {
    const [user] = await this.database
      .insert(users)
      .values({
        name: input.name,
        email: input.email,
        password: input.passwordHash,
        token: input.tokenHash,
      })
      .returning({
        id: users.id,
        name: users.name,
        email: users.email,
      });
    return user;
  }

  async updateSessionHash(userId: string, tokenHash: string): Promise<void> {
    await this.database
      .update(users)
      .set({ token: tokenHash, updatedAt: new Date() })
      .where(eq(users.id, userId));
  }

  async findUserBySessionHash(tokenHash: string): Promise<AuthenticatedUserDto | null> {
    const [user] = await this.database
      .select({ id: users.id, name: users.name })
      .from(users)
      .where(eq(users.token, tokenHash))
      .limit(1);
    return user ?? null;
  }

  async createPost(input: {
    title: string;
    content: string;
    authorId: string;
  }): Promise<PostRecord> {
    const [post] = await this.database.insert(posts).values(input).returning({ id: posts.id });
    const record = await this.findPostById(post.id);
    if (!record) throw new Error("Created post could not be loaded");
    return record;
  }

  async findPostById(id: string): Promise<PostRecord | null> {
    const [record] = await this.database
      .select({
        id: posts.id,
        title: posts.title,
        content: posts.content,
        createdAt: posts.createdAt,
        updatedAt: posts.updatedAt,
        authorId: users.id,
        authorName: users.name,
      })
      .from(posts)
      .innerJoin(users, eq(posts.authorId, users.id))
      .where(eq(posts.id, id))
      .limit(1);
    return record ?? null;
  }

  async listPosts(input: {
    offset: number;
    limit: number;
  }): Promise<{ posts: PostRecord[]; total: number }> {
    const [records, totalRows] = await Promise.all([
      this.database
        .select({
          id: posts.id,
          title: posts.title,
          content: posts.content,
          createdAt: posts.createdAt,
          updatedAt: posts.updatedAt,
          authorId: users.id,
          authorName: users.name,
        })
        .from(posts)
        .innerJoin(users, eq(posts.authorId, users.id))
        .orderBy(desc(posts.createdAt))
        .limit(input.limit)
        .offset(input.offset),
      this.database.select({ total: count() }).from(posts),
    ]);
    return { posts: records, total: totalRows[0]?.total ?? 0 };
  }

  async updatePost(id: string, input: { title?: string; content?: string }): Promise<PostRecord> {
    await this.database
      .update(posts)
      .set({ ...input, updatedAt: new Date() })
      .where(eq(posts.id, id));
    const record = await this.findPostById(id);
    if (!record) throw new Error("Updated post could not be loaded");
    return record;
  }

  async deletePost(id: string): Promise<void> {
    await this.database.delete(posts).where(eq(posts.id, id));
  }
}
