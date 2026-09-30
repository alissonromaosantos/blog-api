import { Router, type RequestHandler } from "express";
import { unauthorized } from "../../shared/errors/app-error.js";
import { validateRequest } from "../../shared/http/middlewares/validate-request.js";
import type { AuthUseCases } from "../auth/use-cases/auth.use-cases.js";
import { PostController } from "./controllers/post.controller.js";
import {
  createPostSchema,
  listPostsQuerySchema,
  postIdParamsSchema,
  updatePostSchema,
} from "./schemas/post.schema.js";
import type { PostUseCases } from "./use-cases/post.use-cases.js";

export function createPostRouter(auth: AuthUseCases, posts: PostUseCases): Router {
  const router = Router();
  const controller = new PostController(posts);
  const authenticate: RequestHandler = async (request, _response, next) => {
    const header = request.get("authorization");
    const match = header?.match(/^Bearer\s+([A-Za-z0-9_-]+)$/i);
    if (!match) {
      next(unauthorized());
      return;
    }
    const user = await auth.authenticate(match[1]);
    if (!user) {
      next(unauthorized("Invalid or expired session token"));
      return;
    }
    request.authUser = user;
    next();
  };

  router.get("/", validateRequest({ query: listPostsQuerySchema }), controller.list);
  router.get("/:id", validateRequest({ params: postIdParamsSchema }), controller.get);
  router.post("/", validateRequest({ body: createPostSchema }), authenticate, controller.create);
  router.put(
    "/:id",
    validateRequest({ params: postIdParamsSchema, body: updatePostSchema }),
    authenticate,
    controller.update,
  );
  router.delete(
    "/:id",
    validateRequest({ params: postIdParamsSchema }),
    authenticate,
    controller.delete,
  );
  return router;
}
