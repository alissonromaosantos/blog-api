export interface PostDto {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  author: { id: string; name: string };
}

export interface PostListDto {
  data: PostDto[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

export interface PostRecord {
  id: string;
  title: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
  authorId: string;
  authorName: string;
}

export function toPostDto(record: PostRecord): PostDto {
  return {
    id: record.id,
    title: record.title,
    content: record.content,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
    author: { id: record.authorId, name: record.authorName },
  };
}
