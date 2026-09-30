import type { PostRecord } from "../dtos/post.dto.js";

export interface PostRepository {
  createPost(input: { title: string; content: string; authorId: string }): Promise<PostRecord>;
  findPostById(id: string): Promise<PostRecord | null>;
  listPosts(input: {
    offset: number;
    limit: number;
  }): Promise<{ posts: PostRecord[]; total: number }>;
  updatePost(id: string, input: { title?: string; content?: string }): Promise<PostRecord>;
  deletePost(id: string): Promise<void>;
}
