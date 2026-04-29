import type { Request, Response, NextFunction } from "express";
import type { AuthService } from "../../auth/service/authService.ts";
import type { ClientService } from "../service/clientService.ts";

import AppError from "../../../shared/utils/appError.ts";
import ResponseFormatter from "../../../shared/utils/responseFormatter.ts";
import { parseBody } from "../../../shared/validation/requestParser.ts";
import {
    createApiKeyBodySchema,
    createClientBodySchema,
    createClientUserBodySchema,
} from "../dto/clientRequestDto.ts";


/** Constructor dependencies for {@link ClientController}. */
export interface ClientControllerDeps {
    /** Client domain service (tenants, users, API keys). */
    clientService: ClientService;
    /** Used for super-admin checks (e.g. client onboarding). */
    authService: AuthService;
}


/**
 * Express handlers for client admin APIs: parse and validate bodies with Zod,
 * delegate to {@link ClientService}, then send JSON via {@link ResponseFormatter}.
 */
export class ClientController {
    private readonly clientService: ClientService;
    private readonly authService: AuthService;

    /**
     * @param deps - Must include `clientService` and `authService`.
     * @throws Error if either dependency is missing.
     */
    constructor(deps: ClientControllerDeps) {
        if (!deps?.clientService) throw new Error("clientService is required");
        if (!deps?.authService) throw new Error("authService is required");
        
        this.clientService = deps.clientService;
        this.authService = deps.authService;
    }


    /** Reads `clientId` from `req.params` or throws {@link AppError} 400. */
    private getClientId(req: Request): string {
        const { clientId } = req.params;
        if (typeof clientId !== "string" || !clientId) {
            throw new AppError("clientId route param is required", 400);
        }
        return clientId;
    }


    /**
     * `POST /admin/clients/onboard` — creates a tenant client. Requires auth;
     * only a super admin may call (enforced via {@link AuthService.checkSuperAdminPermissions}).
     */
    createClient = async (
        req: Request,
        res: Response,
        next: NextFunction
    ): Promise<void> => {
        try {
            const user = req.user;
            if (!user) throw new AppError("Not authenticated", 401);

            const isSuperAdmin = await this.authService.checkSuperAdminPermissions(user.userId);
            if (!isSuperAdmin) {
                throw new AppError("Access denied", 403);
            }

            const body = parseBody(createClientBodySchema, req.body);
            const client = await this.clientService.createClient(body, user);
            res.status(201).json
                (ResponseFormatter.success(client, "Client created successfully", 201));
        } 
        catch (error) { next(error); }
    };


    /**
     * `POST /admin/clients/:clientId/users` — creates a user scoped to the client.
     */
    createClientUser = async (
        req: Request,
        res: Response,
        next: NextFunction
    ): Promise<void> => {
        try {
            const user = req.user;
            if (!user) throw new AppError("Not authenticated", 401);

            const clientId = this.getClientId(req);
            const body = parseBody(createClientUserBodySchema, req.body);
            const createdUser = await this.clientService.createClientUser(clientId, body, user);

            res.status(201).json
                (ResponseFormatter.success(createdUser, "Client user created successfully", 201));
        } 
        catch (error) { next(error); }
    };


    /**
     * `POST /admin/clients/:clientId/api/keys` — issues an API key; response includes
     * the secret `keyValue` once.
     */
    createApiKey = async (
        req: Request,
        res: Response,
        next: NextFunction
    ): Promise<void> => {
        try {
            const user = req.user;
            if (!user) throw new AppError("Not authenticated", 401);

            const clientId = this.getClientId(req);
            const body = parseBody(createApiKeyBodySchema, req.body);
            const apiKey = await this.clientService.createApiKey(clientId, body, user);

            res.status(201).json
                (ResponseFormatter.success(apiKey, "API key created successfully", 201));
        } 
        catch (error) { next(error); }
    };

    
    /**
     * `GET /admin/clients/:clientId/api/keys` — lists API keys for the client (no secrets).
     */
    getClientApiKeys = async (
        req: Request,
        res: Response,
        next: NextFunction
    ): Promise<void> => {
        try {
            const user = req.user;
            if (!user) throw new AppError("Not authenticated", 401);
            
            const clientId = this.getClientId(req);
            const apiKeys = await this.clientService.getClientApiKeys(clientId, user);

            res.status(200).json
                (ResponseFormatter.success(apiKeys, "API keys fetched successfully", 200));
        } 
        catch (error) { next(error); }
    };
}
