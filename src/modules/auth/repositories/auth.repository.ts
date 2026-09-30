import type { AuthenticatedUserDto, SafeUserDto } from "../dtos/auth.dto.js";

export interface AuthUserRecord extends SafeUserDto {
  passwordHash: string;
}

export interface AuthRepository {
  findUserByEmail(email: string): Promise<AuthUserRecord | null>;
  createUser(input: {
    name: string;
    email: string;
    passwordHash: string;
    tokenHash: string;
  }): Promise<SafeUserDto>;
  updateSessionHash(userId: string, tokenHash: string): Promise<void>;
  findUserBySessionHash(tokenHash: string): Promise<AuthenticatedUserDto | null>;
}
