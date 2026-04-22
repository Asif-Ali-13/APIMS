import { z } from "zod";
import { Environment } from "../../../shared/models/ApiKey.ts";
import { UserRole } from "../../../shared/models/User.ts";


/**
 * Schema for onboarding a tenant client.
 *
 * Validates: name, email; optional description and website URL.
 */
export const createClientBodySchema = z.object({
    name: z.string().trim().min(3, "name must be at least 3 characters"),
    email: z.string().trim().email("invalid email"),
    description: z.string().max(500, "description must be at most 500 characters").optional(),
    website: z.string().url("website must be a valid URL").optional(),
});


/** Allowed roles when creating a user under a client (`client_admin` or `client_viewer`). */
const clientRoleSchema = z.union([
    z.literal(UserRole.CLIENT_ADMIN),
    z.literal(UserRole.CLIENT_VIEWER),
]);


/**
 * Schema for creating a client-scoped user.
 *
 * Validates: username, email, password; optional `role` (defaults in service to viewer).
 */
export const createClientUserBodySchema = z.object({
    username: z.string().trim().min(3, "username must be at least 3 characters"),
    email: z.string().trim().email("invalid email"),
    password: z.string().min(6, "password must be at least 6 characters"),
    role: clientRoleSchema.optional(),
});


/**
 * Schema for creating an API key.
 *
 * Validates: name; optional description and deployment `environment`.
 */
export const createApiKeyBodySchema = z.object({
    name: z.string().trim().min(3, "name must be at least 3 characters"),
    description: z.string().max(500, "description must be at most 500 characters").optional(),
    environment: z.nativeEnum(Environment).optional(),
});


/**
 * Inferred request DTOs from the Zod schemas above.
 */
export type CreateClientBodyDto = z.infer<typeof createClientBodySchema>;
export type CreateClientUserBodyDto = z.infer<typeof createClientUserBodySchema>;
export type CreateApiKeyBodyDto = z.infer<typeof createApiKeyBodySchema>;

