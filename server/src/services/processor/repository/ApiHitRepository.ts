import type { Model } from "mongoose";

import { BaseRepository, type RepositoryLogger } from "./BaseRepository.ts";
import type { IApiHit } from "../../../shared/models/ApiHits.ts";


/**
 * Filter type for `Model.find` / `countDocuments`.
 */
type ApiHitFilter = NonNullable<Parameters<Model<IApiHit>["find"]>[0]>;
type MongoDuplicateError = Error & { code?: number };


/**
 * Query options for listing API hit documents.
 */
interface ApiHitFindOptions {
    limit?: number;
    skip?: number;
    sort?: Record<string, 1 | -1 | "asc" | "desc" | { $meta: string }>;
}

/**
 * Constructor dependencies for {@link ApiHitRepository}.
 */
interface ApiHitRepositoryDeps {
    model: Model<IApiHit>;
    logger?: RepositoryLogger;
}


/**
 * MongoDB repository for raw API hit events.
 */
export class ApiHitRepository extends BaseRepository {
    private readonly model: Model<IApiHit>;

    constructor({ model, logger }: ApiHitRepositoryDeps) {
        super({ logger });
        this.model = model;
    }

    /**
     * Saves one API hit event in MongoDB.
     */
    override async save(eventData: Partial<IApiHit>): Promise<IApiHit | null> {
        try {
            const doc = new this.model(eventData);
            await doc.save();
            this.logger.info("API hit saved to MongoDB", { eventId: eventData.eventId });
            return doc;
        } 
        catch (error: unknown) {
            const mongoError = error as MongoDuplicateError;
            if (mongoError.code === 11000) {
                this.logger.warn("Duplicate event ID, skipping save", { eventId: eventData.eventId });
                return null;
            }
            this.logger.error("Error saving API hit", { error });
            throw error;
        }
    }

    /**
     * Retrieves API hits with pagination and sorting.
     */
    override async find(
        filter: ApiHitFilter = {} as ApiHitFilter,
        options: ApiHitFindOptions = {}
    ): Promise<Array<Partial<IApiHit>>> {
        try {
            const { limit = 100, skip = 0, sort = { timestamp: -1 } } = options;
            const hits = await this.model
                .find(filter)
                .sort(sort)
                .limit(limit)
                .skip(skip)
                .lean();
            return hits as Array<Partial<IApiHit>>;
        } 
        catch (error: unknown) {
            this.logger.error("Error finding API hits", { error });
            throw error;
        }
    }

    /**
     * Counts API hits for the given filter.
     */
    override async count(filters: ApiHitFilter = {} as ApiHitFilter): Promise<number> {
        try {
            return await this.model.countDocuments(filters);
        } 
        catch (error: unknown) {
            this.logger.error("Error counting API hits", { error });
            throw error;
        }
    }

    /**
     * Deletes old API hits by timestamp.
     */
    override async deleteOldHits(beforeDate: Date): Promise<number> {
        try {
            const result = await this.model.deleteMany({ timestamp: { $lt: beforeDate } });
            const deletedCount = result.deletedCount ?? 0;
            this.logger.info("Deleted old API hits", { count: deletedCount });
            return deletedCount;
        } 
        catch (error: unknown) {
            this.logger.error("Error deleting old API hits", { error });
            throw error;
        }
    }
}