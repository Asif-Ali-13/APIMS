/**
 * Persistence contract for `IClient` documents.
 *
 * Extends {@link IBaseRepository} and adds slug lookup for routing and uniqueness checks.
 *
 * @module services/client/repositories/IClientRepository
 */
import type { IClient } from "../../../shared/models/Client.ts";
import type { IBaseRepository } from "./IBaseRepository.ts";


export interface IClientRepository extends IBaseRepository<IClient, string> {
    /**
     * Resolves a client by URL slug (unique, lowercased in schema).
     *
     * @param slug - Generated or stored slug for the tenant.
     * @returns The client document or null.
     */
    findBySlug(slug: string): Promise<IClient | null>;
}
