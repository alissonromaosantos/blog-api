import type { PostDto, PostListDto } from "../dtos/post.dto.js";
import { toPostDto } from "../dtos/post.dto.js";
import type { PostRepository } from "../repositories/post.repository.js";
import type { CreatePostInput, ListPostsQuery, UpdatePostInput } from "../schemas/post.schema.js";
import { forbidden, notFound } from "../../../shared/errors/app-error.js";

const PAGE_SIZE = 10;

export class PostUseCases {
  constructor(private readonly repository: PostRepository) {}

  async list(input: ListPostsQuery): Promise<PostListDto> {
    const offset = (input.page - 1) * PAGE_SIZE;
    const result = await this.repository.listPosts({
      offset,
      limit: PAGE_SIZE,
    });
    return {
      data: result.posts.map(toPostDto),
      meta: {
        page: input.page,
        limit: PAGE_SIZE,
        total: result.total,
        totalPages: Math.ceil(result.total / PAGE_SIZE),
      },
    };
  }

  async get(id: string): Promise<PostDto> {
    const post = await this.repository.findPostById(id);
    if (!post) throw notFound("Post not found");
    return toPostDto(post);
  }

  async create(input: CreatePostInput, authorId: string): Promise<PostDto> {
    return toPostDto(await this.repository.createPost({ ...input, authorId }));
  }

  async update(id: string, authorId: string, input: UpdatePostInput): Promise<PostDto> {
    const post = await this.repository.findPostById(id);
    if (!post) throw notFound("Post not found");
    if (post.authorId !== authorId) throw forbidden("You can only update your own posts");
    return toPostDto(await this.repository.updatePost(id, input));
  }

  async delete(id: string, authorId: string): Promise<void> {
    const post = await this.repository.findPostById(id);
    if (!post) throw notFound("Post not found");
    if (post.authorId !== authorId) throw forbidden("You can only delete your own posts");
    await this.repository.deletePost(id);
  }
}
