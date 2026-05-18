/**
 * Shared repository primitives for the processor module.
 *
 * @module services/processor/repository/BaseRepository
 */


/**
 * Logger contract used by repositories.
 */
export interface RepositoryLogger {
    info: (message: string, meta?: unknown) => void;
    warn: (message: string, meta?: unknown) => void;
    error: (message: string, meta?: unknown) => void;
    debug?: (message: string, meta?: unknown) => void;
}

/**
 * Constructor options for {@link BaseRepository}.
 * `logger` may be omitted or explicitly `undefined` (see `exactOptionalPropertyTypes`).
 */
export interface BaseRepositoryOptions {
    logger?: RepositoryLogger | undefined;
}


/**
 * Base class for repositories in the processor slice.
 * Concrete repositories should override methods they support.
 */
export class BaseRepository {
    protected readonly logger: RepositoryLogger;

    constructor(options: BaseRepositoryOptions = {}) {
        this.logger = options.logger ?? console;
    }

    /**
     * Persists a domain entity.
     */
    async save(_input: unknown): Promise<unknown> {
        throw new Error("Method not implemented: save");
    }

    /**
     * Finds entities matching optional filters.
     */
    async find(_filter?: unknown, _options?: unknown): Promise<unknown> {
        throw new Error("Method not implemented: find");
    }

    /**
     * Counts entities matching optional filters.
     */
    async count(_filter?: unknown): Promise<number> {
        throw new Error("Method not implemented: count");
    }

    /**
     * Deletes old API hit documents based on timestamp.
     */
    async deleteOldHits(_beforeDate: Date): Promise<number> {
        throw new Error("Method not implemented: deleteOldHits");
    }
}