import type { UserRole } from "../../../shared/models/User.ts";

/** 
 * Claims embedded in the access JWT (matches what we sign in AuthService).
 */
export type JwtAccessPayload = {
    userId: string;
    username: string;
    email: string;
    role: UserRole;
} & ({ clientId: string } | { clientId?: never });

