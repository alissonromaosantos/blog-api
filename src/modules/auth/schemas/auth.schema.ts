import { z } from "zod";

export const signupSchema = z
  .object({
    name: z.string().trim().min(1).max(100),
    email: z
      .string()
      .trim()
      .email()
      .transform((value) => value.toLowerCase()),
    password: z.string().min(6),
  })
  .strict();

export const signinSchema = z
  .object({
    email: z
      .string()
      .trim()
      .email()
      .transform((value) => value.toLowerCase()),
    password: z.string().min(6),
  })
  .strict();

export type SignupInput = z.infer<typeof signupSchema>;
export type SigninInput = z.infer<typeof signinSchema>;
