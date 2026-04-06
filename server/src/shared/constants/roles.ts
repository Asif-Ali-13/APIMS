import { UserRole } from "../models/User.ts";

/** 
 * App-facing role constants (aligned with `UserRole`). 
 */
export const APPLICATION_ROLES = {
    SUPER_ADMIN: UserRole.SUPER_ADMIN,
    CLIENT_ADMIN: UserRole.CLIENT_ADMIN,
    CLIENT_VIEWER: UserRole.CLIENT_VIEWER,
} as const;


/**
 * check whether the role(`value`) is Present in the APPLICATION_ROLES or not
 * 
 * @param value - unknown 
 * @returns boolean 
 */
export function isValidRole(value: unknown): value is UserRole {
    return (
        typeof value === "string" &&
        (Object.values(UserRole) as string[]).includes(value)
    );
}
