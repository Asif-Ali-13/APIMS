import type { ZodSchema, ZodError } from "zod";
import AppError from "../utils/appError.ts";

function zodIssuesToMessages(error: ZodError): string[] {
    return error.issues.map((issue) => {
        const path = issue.path.length ? issue.path.join(".") : "body";
        return `${path}: ${issue.message}`;
    });
}

/**
 * Validates and parses a request body using a Zod schema.
 *
 * If validation fails, throws an {@link AppError} with status 400 and
 * a list of human-readable validation messages.
 */
export function parseBody<T>(schema: ZodSchema<T>, body: unknown): T {
    const result = schema.safeParse(body);

    if (!result.success) {
        const errors = zodIssuesToMessages(result.error);
        throw new AppError("Validation failed", 400, errors);
    }

    return result.data;
}

