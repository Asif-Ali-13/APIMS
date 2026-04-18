/**
 * Persistence contract for `IApiKey` documents.
 *
 * Extends {@link IBaseRepository} with lookups 
 * for ingestion auth and per-client key management.
 *
 * @module services/client/repositories/IApiKeyRepository
 */
import type { IApiKey } from "../../../shared/models/ApiKey.ts";
import type { QueryFilter } from "mongoose";
import type { IBaseRepository } from "./IBaseRepository.ts";


export interface IApiKeyRepository extends IBaseRepository<IApiKey, string> {
    /**
     * Resolves a key by its secret `keyValue`.
     * When `includeInactive` is false, only active keys match.
     *
     * @param keyValue - Raw secret sent by the client.
     * @param includeInactive - When true, inactive keys may match.
     * @returns The key document or null.
     */
    findByKeyValue(
        keyValue: string,
        includeInactive?: boolean
    ): Promise<IApiKey | null>;

    /**
     * Lists keys for a tenant. `additionalFilter` is merged with `{ clientId }`
     * (caller should not override `clientId`). Implementations typically populate `createdBy`
     * for list responses.
     *
     * @param clientId - Tenant id (`_id` as string).
     * @param additionalFilter - Optional mongoose filter merged into the query.
     * @returns Keys ordered newest-first where the implementation defines sort.
     */
    findByClientId(
        clientId: string,
        additionalFilter?: QueryFilter<IApiKey>
    ): Promise<IApiKey[]>;

    /**
     * Counts keys for a tenant with optional extra query conditions.
     *
     * @param clientId - Tenant id (`_id` as string).
     * @param additionalFilter - Optional extra conditions (must not replace `clientId` intent).
     * @returns Document count.
     */
    countByClientId(
        clientId: string,
        additionalFilter?: QueryFilter<IApiKey>
    ): Promise<number>;
}
