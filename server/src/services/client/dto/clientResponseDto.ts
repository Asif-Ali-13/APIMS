import type { UserPublicDto } from "../../auth/dto/authResponseDto.ts";

/**
 * User returned after creating a user under a client (no password; stable API shape).
 * Aliases {@link UserPublicDto} so client module responses stay aligned with auth.
 */
export type ClientUserPublicDto = UserPublicDto;


/**
 * Public representation of a tenant client.
 *
 * Excludes internal Mongoose fields; `createdBy` is the super-admin id string who onboarded the client.
 */
export interface ClientPublicDto {
    _id: string;
    name: string;
    slug: string;
    email: string;
    isActive: boolean;
    createdBy: string;
    description?: string | undefined;
    website?: string | undefined;
    createdAt?: string | undefined;
    updatedAt?: string | undefined;
}


/**
 * Public API key metadata returned after create or when `createdBy` is not populated as a user.
 *
 * Never includes `keyValue` except on {@link ApiKeyCreatedDto}. `createdBy` is an id string unless
 * a list-specific DTO overrides it (see {@link ClientApiKeyListItemDto}).
 */
export interface ApiKeyPublicDto {
    _id: string;
    keyId: string;
    clientId: string;
    name: string;
    environment: string;
    isActive: boolean;
    createdBy: string;
    description?: string | undefined;
    createdAt?: string | undefined;
    updatedAt?: string | undefined;
}


/**
 * Minimal creator fields when listing API keys (matches `populate("createdBy", "username email")`).
 */
export interface ApiKeyCreatedByPublicDto {
    _id: string;
    username: string;
    email: string;
}


/**
 * Response right after creating an API key — includes the secret once for the client to store.
 */
export type ApiKeyCreatedDto = ApiKeyPublicDto & { keyValue: string };


/**
 * One row when listing API keys for a client (never includes `keyValue`).
 * `createdBy` is expanded because the list query populates the User ref.
 */
export type ClientApiKeyListItemDto = Omit<ApiKeyPublicDto, "createdBy"> & {
    createdBy: ApiKeyCreatedByPublicDto;
};

