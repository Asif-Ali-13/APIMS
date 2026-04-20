/**
 * Mongoose implementation of {@link IClientRepository}.
 *
 * @module services/client/repositories/ClientRepository
 */
import { Model, type QueryFilter, type QueryOptions } from "mongoose";

import type { IClientRepository } from "./IClientRepository.ts";
import logger from "../../../shared/config/logger.ts";
import Client, { type IClient } from "../../../shared/models/Client.ts";


export class MongoClientRepository implements IClientRepository {
    private readonly model: Model<IClient>;

    /**
     * @param model - Defaults to the app `Client` model.
     */
    constructor(model: Model<IClient> = Client) {
        this.model = model;
    }

    /** @inheritdoc */
    async create(clientData: Partial<IClient>): Promise<IClient> {
        try {
            const client = new this.model(clientData);
            await client.save();

            logger.info("Client created", {
                mongoId: String(client._id),
                slug: client.slug,
            });

            return client;
        } 
        catch (error) {
            logger.error("Error creating client", error);
            throw error;
        }
    }

    /** @inheritdoc */
    async findById(clientId: string): Promise<IClient | null> {
        try {
            return await this.model.findById(clientId).exec();
        } 
        catch (error) {
            logger.error("Error finding client by id", error);
            throw error;
        }
    }

    /** @inheritdoc */
    async findBySlug(slug: string): Promise<IClient | null> {
        try {
            return await this.model.findOne({ slug }).exec();
        } 
        catch (error) {
            logger.error("Error finding client by slug", error);
            throw error;
        }
    }

    /** @inheritdoc */
    async findOne(
        filter: QueryFilter<IClient>,
        options?: QueryOptions<IClient>
    ): Promise<IClient | null> {
        try {
            return await this.model.findOne(filter, null, options).exec();
        } 
        catch (error) {
            logger.error("Error finding client (findOne)", error);
            throw error;
        }
    }

    /**
     * @inheritdoc
     * Applies defaults: `limit` 50, `skip` 0, `sort` `{ createdAt: -1 }`, and strips `__v`.
     */
    async find(
        filter: QueryFilter<IClient>,
        options?: QueryOptions<IClient>
    ): Promise<IClient[]> {
        // In future i will try to use the cursor pagination
        try {
            const limit = options?.limit ?? 50;
            const skip = options?.skip ?? 0;
            const sort = options?.sort ?? { createdAt: -1 };

            return await this.model
                .find(filter, null, { ...options, limit, skip, sort })
                .select("-__v")
                .exec();
        } 
        catch (error) {
            logger.error("Error listing clients", error);
            throw error;
        }
    }

    /** @inheritdoc */
    async countDocuments(filter: QueryFilter<IClient>): Promise<number> {
        try {
            return await this.model.countDocuments(filter).exec();
        } 
        catch (error) {
            logger.error("Error counting clients", error);
            throw error;
        }
    }
}

export default new MongoClientRepository();
