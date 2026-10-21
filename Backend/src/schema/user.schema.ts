import { z } from "zod";

/**
 * this schema describes and validate the new input body.
 */
export const InitSessionBodySchema = z.object({
    nickname: z
        .string()
        .trim()
        .min(3, "Nickname must be greater than 2 characters")
        .max(16, "Nickname cannot exceed 16 characters")
        .regex(/^[a-zA-Z0-9_-]+$/, "Only letters, numbers, _ and - allowed")
        .optional(),
});

export type InitSessionBody = z.infer<typeof InitSessionBodySchema>;
