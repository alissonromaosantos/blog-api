import { Router } from "express";
import { AuthController } from "./controllers/auth.controller.js";
import { signupSchema, signinSchema } from "./schemas/auth.schema.js";
import type { AuthUseCases } from "./use-cases/auth.use-cases.js";
import { validateRequest } from "../../shared/http/middlewares/validate-request.js";

export function createAuthRouter(useCases: AuthUseCases): Router {
  const router = Router();
  const controller = new AuthController(useCases);
  router.post("/signup", validateRequest({ body: signupSchema }), controller.signUp);
  router.post("/signin", validateRequest({ body: signinSchema }), controller.signIn);
  return router;
}
