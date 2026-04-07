
import { z } from "zod";
import { UserRole } from "../../../shared/models/User";

/**
 * Schema for onboarding the initial Super Admin.
 *
 * Validates: username, email, password
 */
export const onboardSuperAdminBodySchema = z.object({
    username: z.string().trim().min(3, "username must be at least 3 characters"),
    email: z.string().trim().email("invalid email"),
    password: z.string().min(6, "password must be at least 6 characters"),
});

/**
 * Schema for user registration.
 *
 * Validates: username, email, password, role
 * - role: optional, must be a valid UserRole enum
 */
export const registerBodySchema = z.object({
    username: z.string().trim().min(3, "username must be at least 3 characters"),
    email: z.string().trim().email("invalid email"),
    password: z.string().min(6, "password must be at least 6 characters"),
    role: z.nativeEnum(UserRole).optional(),
});

/**
 * Schema for user login.
 *
 * Validates: username, password
 */
export const loginBodySchema = z.object({
    username: z.string().trim().min(1, "username is required"),
    password: z.string().min(1, "password is required"),
});


/**
 * DTOs for different request body.
 */
export type OnboardSuperAdminBodyDto = z.infer<typeof onboardSuperAdminBodySchema>;
export type RegisterBodyDto = z.infer<typeof registerBodySchema>;
export type LoginBodyDto = z.infer<typeof loginBodySchema>;
