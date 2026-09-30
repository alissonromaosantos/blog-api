import type { RequestHandler } from "express";
import type { AuthUseCases } from "../use-cases/auth.use-cases.js";
import type { SigninInput, SignupInput } from "../schemas/auth.schema.js";

export class AuthController {
  constructor(private readonly useCases: AuthUseCases) {}

  signUp: RequestHandler = async (request, response) => {
    const input = request.validated?.body as SignupInput;
    response.status(201).json(await this.useCases.signUp(input));
  };

  signIn: RequestHandler = async (request, response) => {
    const input = request.validated?.body as SigninInput;
    response.status(200).json(await this.useCases.signIn(input));
  };
}
