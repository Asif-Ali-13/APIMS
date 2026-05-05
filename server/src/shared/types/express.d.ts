import type { UserRole } from "../models/User.ts";
import type { IApiKey } from "../models/ApiKey.ts";
import type { IClient } from "../models/Client.ts";

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
            /** Set by API key middleware for ingest requests. */
            client?: IClient;
            /** Set by API key middleware for ingest requests. */
            apiKey?: IApiKey;
        }
    }
}

export {};
