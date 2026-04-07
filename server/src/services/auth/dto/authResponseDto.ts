import type { UserRole } from "../../../shared/models/User.ts";

/**
 * Represents permission flags assigned to a user.
 *
 * These permissions are typically derived from the user's role
 * and determine what actions the user is allowed to perform
 * within the system.
 */
export interface UserPermissionsDto {
    canCreateApiKeys: boolean;
    canManageUsers: boolean;
    canViewAnalytics: boolean;
    canExportData: boolean;
}

/**
 * Public representation of a user.
 *
 * This DTO is safe to expose via APIs and excludes sensitive
 * information such as passwords or internal metadata.
 *
 * Provides a consistent and stable JSON shape for clients.
 */
export interface UserPublicDto {
    _id: string;
    username: string;
    email: string;
    role: UserRole;
    isActive: boolean;
    permissions: UserPermissionsDto;
    clientId?: string;
    createdAt?: string;
    updatedAt?: string;
}

/**
 * Response DTO for successful authentication.
 *
 * Returned after login or registration.
 * Contains:
 * - Public user details
 * - Authentication token (JWT)
 */
export interface AuthSuccessDto {
    user: UserPublicDto;
    token: string;
}
