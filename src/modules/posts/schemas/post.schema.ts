import { z } from "zod";

export const postIdParamsSchema = z.object({ id: z.string().uuid() }).strict();

export const listPostsQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
  })
  .strict();

export const createPostSchema = z
  .object({
    title: z.string().trim().min(1).max(200),
    content: z.string().trim().min(1),
  })
  .strict();

export const updatePostSchema = z
  .object({
    title: z.string().trim().min(1).max(200).optional(),
    content: z.string().trim().min(1).optional(),
  })
  .strict()
  .refine((value) => value.title !== undefined || value.content !== undefined, {
    message: "At least one of title or content must be provided",
  });

export type ListPostsQuery = z.infer<typeof listPostsQuerySchema>;
export type CreatePostInput = z.infer<typeof createPostSchema>;
export type UpdatePostInput = z.infer<typeof updatePostSchema>;
