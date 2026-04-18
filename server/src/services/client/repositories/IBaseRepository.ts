/**
 * Generic repository contract for the client vertical (Mongoose-backed).
 *
 * `QueryFilter` / `QueryOptions` match mongoose so implementations can forward to `Model`
 * without ad hoc casting.
 *
 * @template T - Document type (e.g. `IClient`, `IApiKey`)
 * @template ID - Type of the id passed to `findById` (default: `string`)
 *
 * @module services/client/repositories/IBaseRepository
 */
import type { QueryFilter, QueryOptions } from "mongoose";


export interface IBaseRepository<T, ID = string> {
    /**
     * Persists a new document.
     */
    create(data: Partial<T>): Promise<T>;

    /**
     * Loads one document by primary key (`_id` as string or `ObjectId`).
     */
    findById(id: ID): Promise<T | null>;

    /**
     * First document matching `filter`, or `null` (mongoose `findOne`).
     */
    findOne(
        filter: QueryFilter<T>,
        options?: QueryOptions<T>
    ): Promise<T | null>;

    /**
     * All documents matching `filter`, honoring `options` (e.g. `sort`, `limit`, `skip`).
     */
    find(
        filter: QueryFilter<T>,
        options?: QueryOptions<T>
    ): Promise<T[]>;

    /**
     * Document count for `filter` (mongoose `countDocuments`).
     */
    countDocuments(filter: QueryFilter<T>): Promise<number>;
}
