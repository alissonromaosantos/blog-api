import type { RequestHandler } from "express";
import { requireAuthUser } from "../../../shared/http/request-context.js";
import type { CreatePostInput, ListPostsQuery, UpdatePostInput } from "../schemas/post.schema.js";
import type { PostUseCases } from "../use-cases/post.use-cases.js";

export class PostController {
  constructor(private readonly useCases: PostUseCases) {}

  list: RequestHandler = async (request, response) => {
    const query = request.validated?.query as ListPostsQuery;
    response.status(200).json(await this.useCases.list(query));
  };

  get: RequestHandler = async (request, response) => {
    const params = request.validated?.params as { id: string };
    response.status(200).json(await this.useCases.get(params.id));
  };

  create: RequestHandler = async (request, response) => {
    const input = request.validated?.body as CreatePostInput;
    const user = requireAuthUser(request);
    response.status(201).json(await this.useCases.create(input, user.id));
  };

  update: RequestHandler = async (request, response) => {
    const params = request.validated?.params as { id: string };
    const input = request.validated?.body as UpdatePostInput;
    const user = requireAuthUser(request);
    response.status(200).json(await this.useCases.update(params.id, user.id, input));
  };

  delete: RequestHandler = async (request, response) => {
    const params = request.validated?.params as { id: string };
    const user = requireAuthUser(request);
    await this.useCases.delete(params.id, user.id);
    response.status(204).end();
  };
}
