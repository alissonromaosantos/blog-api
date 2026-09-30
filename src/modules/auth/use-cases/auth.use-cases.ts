import { createHash, randomBytes } from "node:crypto";
import type { AuthResponseDto, AuthenticatedUserDto } from "../dtos/auth.dto.js";
import type { AuthRepository } from "../repositories/auth.repository.js";
import type { SigninInput, SignupInput } from "../schemas/auth.schema.js";
import { AppError, unauthorized } from "../../../shared/errors/app-error.js";

export interface PasswordHasher {
  hash(value: string): Promise<string>;
  compare(value: string, hashedValue: string): Promise<boolean>;
}

export interface SessionTokenService {
  create(): { token: string; hash: string };
  hash(token: string): string;
}

export class AuthUseCases {
  constructor(
    private readonly repository: AuthRepository,
    private readonly passwordHasher: PasswordHasher,
    private readonly sessions: SessionTokenService,
  ) {}

  async signUp(input: SignupInput): Promise<AuthResponseDto> {
    const passwordHash = await this.passwordHasher.hash(input.password);
    const session = this.sessions.create();
    try {
      const user = await this.repository.createUser({
        name: input.name,
        email: input.email,
        passwordHash,
        tokenHash: session.hash,
      });
      return { token: session.token, user };
    } catch (error) {
      if (isUniqueViolation(error)) throw new AppError(409, "CONFLICT", "Email already registered");
      throw error;
    }
  }

  async signIn(input: SigninInput): Promise<AuthResponseDto> {
    const user = await this.repository.findUserByEmail(input.email);
    if (!user || !(await this.passwordHasher.compare(input.password, user.passwordHash))) {
      throw unauthorized("Invalid email or password");
    }
    const session = this.sessions.create();
    await this.repository.updateSessionHash(user.id, session.hash);
    return {
      token: session.token,
      user: { id: user.id, name: user.name, email: user.email },
    };
  }

  authenticate(token: string): Promise<AuthenticatedUserDto | null> {
    return this.repository.findUserBySessionHash(this.sessions.hash(token));
  }
}

export function createSessionTokenService(): SessionTokenService {
  const hash = (token: string) => createHash("sha256").update(token).digest("hex");
  return {
    create() {
      const token = randomBytes(32).toString("base64url");
      return { token, hash: hash(token) };
    },
    hash,
  };
}

function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "23505";
}
