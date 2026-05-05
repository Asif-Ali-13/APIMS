/**
 * Client domain service: tenant (client) onboarding, client-scoped users, and API keys.
 * Uses DTOs at boundaries; {@link IClient} / {@link IApiKey} and `User` documents stay
 * behind repositories and the client mapper.
 *
 * @module services/client/service/clientService
 */
import crypto from "crypto";
import { Types } from "mongoose";

import logger from "../../../shared/config/logger.ts";
import { APPLICATION_ROLES } from "../../../shared/constants/roles.ts";
import AppError from "../../../shared/utils/appError.ts";

import { Environment, type IApiKey } from "../../../shared/models/ApiKey.ts";
import type { IClient } from "../../../shared/models/Client.ts";
import type { UserRole } from "../../../shared/models/User.ts";

import {
    toApiKeyCreatedDto,
    toClientApiKeyListItemDto,
    toClientPublicDto,
    toClientUserPublicDto,
} from "../mapper/clientMapper.ts";

import type {
    ApiKeyCreatedDto,
    ClientApiKeyListItemDto,
    ClientPublicDto,
    ClientUserPublicDto,
} from "../dto/clientResponseDto.ts";

import type {
    CreateApiKeyBodyDto,
    CreateClientBodyDto,
    CreateClientUserBodyDto,
} from "../dto/clientRequestDto.ts";

import type { IApiKeyRepository } from "../repositories/IApiKeyRepository.ts";
import type { IClientRepository } from "../repositories/IClientRepository.ts";
import type { IUserRepository } from "../../auth/repository/IUserRepository.ts";


type AuthenticatedUser = NonNullable<Express.Request["user"]>;
type PopulatedClient = IClient & { _id: Types.ObjectId };

export interface ClientByApiKeyResult {
    client: PopulatedClient;
    apiKey: IApiKey;
}

/** Constructor dependencies for {@link ClientService}. */
export interface ClientServiceDeps {
    /** Tenant (client) persistence. */
    clientRepository: IClientRepository;
    /** API key persistence. */
    apiKeyRepository: IApiKeyRepository;
    /** User persistence (creates client-scoped users). */
    userRepository: IUserRepository;
}

/**
 * Coordinates validation, authorization, and persistence for the client vertical.
 */
export class ClientService {
    private readonly clientRepository: IClientRepository;
    private readonly apiKeyRepository: IApiKeyRepository;
    private readonly userRepository  : IUserRepository;

    /**
     * @param deps - Must include `clientRepository`, `apiKeyRepository`, and `userRepository`.
     * @throws Error if any dependency is missing.
     */
    constructor(deps: ClientServiceDeps) {
        if (!deps?.clientRepository) throw new Error("clientRepository is required");
        if (!deps?.apiKeyRepository) throw new Error("apiKeyRepository is required");
        if (!deps?.userRepository)   throw new Error("userRepository is required");
        
        this.clientRepository = deps.clientRepository;
        this.apiKeyRepository = deps.apiKeyRepository;
        this.userRepository = deps.userRepository;
    }


    /** True when `role` is a client-scoped role allowed in this module. */
    private isValidClientRole(role: unknown): role is UserRole {
        return (
            role === APPLICATION_ROLES.CLIENT_ADMIN ||
            role === APPLICATION_ROLES.CLIENT_VIEWER
        );
    }

    /** URL-safe slug from display name (lowercase, hyphenated). */
    private generateSlug(name: string): string {
        return name
            .toLowerCase()
            .replace(/[^a-z0-9\s-]/g, "") 
            .replace(/\s+/g, "-")       // replace spaces with hyphens
            .replace(/-+/g, "-")        // replace multiple hyphens with one
            .replace(/^-+|-+$/g, "")    // remove hyphens at start/end
            .trim();
    }

    /** Super admin may access any client; others only their own `clientId`. */
    private canUserAccessClient(user: AuthenticatedUser, clientId: string): boolean {
        if (user.role === APPLICATION_ROLES.SUPER_ADMIN) return true;
        return typeof user.clientId === "string" && user.clientId === clientId;
    }

    /** Opaque secret prefix + random hex (single-use display on create). */
    private generateApiKeyValue(): string {
        // future enhancement : snowflake id generation
        return `apim_${crypto.randomBytes(20).toString("hex")}`;
    }


    /**
     * Creates a client (tenant) with a unique slug derived from `input.name`.
     * @throws AppError 409 when the slug already exists.
     */
    async createClient(
        input: CreateClientBodyDto,
        adminUser: AuthenticatedUser
    ): Promise<ClientPublicDto> {
        
        try {
            const slug = this.generateSlug(input.name);
            const existingClient = await this.clientRepository.findBySlug(slug);
            if (existingClient) {
                throw new AppError(`Client with slug ${slug} already exists`, 409);
            }

            const clientData: Partial<IClient> = {
                name: input.name,
                slug,
                email: input.email,
                isActive: true,
                createdBy: new Types.ObjectId(adminUser.userId),
            };

            if (input.description !== undefined) clientData.description = input.description;
            if (input.website !== undefined) clientData.website = input.website;
            
            const client = await this.clientRepository.create(clientData);
            return toClientPublicDto(client);
        } 
        catch (error) {
            logger.error("Error creating client", error);
            throw error;
        }
    }


    /**
     * Creates a user belonging to `clientId` with client role and derived permissions.
     * @throws AppError 404 when the client does not exist; 403 when the caller cannot access the client;
     *   400 when `role` is not allowed for client users.
     */
    async createClientUser(
        clientId: string,
        input: CreateClientUserBodyDto,
        adminUser: AuthenticatedUser
    ): Promise<ClientUserPublicDto> {
        try {
            const client = await this.clientRepository.findById(clientId);
            if (!client) {
                throw new AppError("Client not found", 404);
            }

            if (!this.canUserAccessClient(adminUser, clientId)) {
                throw new AppError("Access denied", 403);
            }

            const role = input.role ?? APPLICATION_ROLES.CLIENT_VIEWER;
            if (!this.isValidClientRole(role)) {
                throw new AppError("Invalid role for client user", 400);
            }

            const permissions = role === APPLICATION_ROLES.CLIENT_ADMIN
                ? {
                    canCreateApiKeys: true,
                    canManageUsers: true,
                    canViewAnalytics: true,
                    canExportData: true,
                }
                : {
                    canCreateApiKeys: false,
                    canManageUsers: false,
                    canViewAnalytics: true,
                    canExportData: false,
                };

            const user = await this.userRepository.create({
                username: input.username,
                email: input.email,
                password: input.password,
                role,
                clientId: new Types.ObjectId(clientId),
                permissions,
            });

            logger.info("Client user created", {
                clientId,
                userId: String(user._id),
                role,
            });

            return toClientUserPublicDto(user);
        } 
        catch (error) {
            logger.error("Error creating client user", error);
            throw error;
        }
    }


    /**
     * Persists a new API key for the client and returns the public DTO plus secret `keyValue`.
     * @throws AppError 404 when the client does not exist; 403 when access or create-key permission is denied.
     */
    async createApiKey(
        clientId: string,
        input: CreateApiKeyBodyDto,
        user: AuthenticatedUser
    ): Promise<ApiKeyCreatedDto> {
        try {
            const client = await this.clientRepository.findById(clientId);
            if (!client) {
                throw new AppError("Client not found", 404);
            }

            if (!this.canUserAccessClient(user, clientId)) {
                throw new AppError("Access denied", 403);
            }

            const canCreateApiKey =
                user.role === APPLICATION_ROLES.SUPER_ADMIN ||
                user.role === APPLICATION_ROLES.CLIENT_ADMIN;
            if (!canCreateApiKey) {
                throw new AppError(
                    "Access denied - Only Super Admin and Client Admin can create API keys",
                    403
                );
            }

            const keyId = crypto.randomUUID();
            const keyValue = this.generateApiKeyValue();

            const apiKeyData: Partial<IApiKey> = {
                keyId,
                keyValue,
                clientId: new Types.ObjectId(clientId),
                name: input.name,
                environment: input.environment ?? Environment.PRODUCTION,
                createdBy: new Types.ObjectId(user.userId),
                isActive: true,
            };
            if (input.description !== undefined) apiKeyData.description = input.description;

            const apiKey = await this.apiKeyRepository.create(apiKeyData);
            return toApiKeyCreatedDto(apiKey);
        } 
        catch (error) {
            logger.error("Error creating API key", error);
            throw error;
        }
    }

    
    /**
     * Lists API keys for `clientId` with populated creator summary (no `keyValue`).
     * @throws AppError 403 when the caller cannot access the client.
     */
    async getClientApiKeys(
        clientId: string,
        user: AuthenticatedUser
    ): Promise<ClientApiKeyListItemDto[]> {
        try {
            if (!this.canUserAccessClient(user, clientId)) {
                throw new AppError("Access denied to this client", 403);
            }

            const apiKeys = await this.apiKeyRepository.findByClientId(clientId);
            return apiKeys.map((key) => toClientApiKeyListItemDto(key));
        } 
        catch (error) {
            logger.error("Error getting client API keys", error);
            throw error;
        }
    }

    /**
     * Resolves an active, non-expired API key to its owning client.
     * Used by ingest authentication middleware to attach `req.client` and `req.apiKey`.
     *
     * @param apiKey - Raw API key value from request header.
     * @returns Client + key tuple when valid; otherwise `null`.
     */
    async getClientByApiKey(apiKey: string): Promise<ClientByApiKeyResult | null> {
        try {
            const key = await this.apiKeyRepository.findByKeyValue(apiKey);
            
            if (!key) { return null; }
            if (key.isExpired()) { return null; }

            const client = key.clientId as unknown as PopulatedClient;
            if (!client || typeof client !== "object" || !("isActive" in client)) {
                return null;
            }
            
            return { client, apiKey: key, };
        } 
        catch (error) {
            logger.error('Error finding client by API key:', error);
            throw error;
        }
    }
}
