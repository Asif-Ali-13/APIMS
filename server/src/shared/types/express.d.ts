import type { UserRole } from "../models/User.ts";

declare global {
    namespace Express {
        interface Request {
        /** Set by auth middleware after JWT verification. */
            user?: {
                userId: string;
                username?: string;
                email?: string;
                role?: UserRole;
                clientId?: string;
            };
        }
    }
}

export {};
