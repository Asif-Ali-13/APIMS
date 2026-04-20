/**
 * Mongoose implementation of {@link IApiKeyRepository}.
 *
 * @module services/client/repositories/ApiKeyRepository
 */
import { Model, type QueryFilter, type QueryOptions } from "mongoose";

import logger from "../../../shared/config/logger.ts";
import type { IApiKeyRepository } from "./IApiKeyRepository.ts";
import ApiKey, { type IApiKey } from "../../../shared/models/ApiKey.ts";


export class MongoApiKeyRepository implements IApiKeyRepository {
    private readonly model: Model<IApiKey>;

    /**
     * @param model - Defaults to the app `ApiKey` model.
     */
    constructor(model: Model<IApiKey> = ApiKey) {
        this.model = model;
    }

    /** @inheritdoc */
    async create(apiKeyData: Partial<IApiKey>): Promise<IApiKey> {
        try {
            const apiKey = new this.model(apiKeyData);
            await apiKey.save();
            
            logger.info("API key created", { keyId: apiKey.keyId });
            return apiKey;
        } 
        catch (error) {
            logger.error("Error creating API key", error);
            throw error;
        }
    }

    /** @inheritdoc */
    async findById(id: string): Promise<IApiKey | null> {
        try {
            return await this.model.findById(id).exec();
        } 
        catch (error) {
            logger.error("Error finding API key by id", error);
            throw error;
        }
    }

    /** @inheritdoc */
    async findOne(
        filter: QueryFilter<IApiKey>,
        options?: QueryOptions<IApiKey>
    ): Promise<IApiKey | null> {
        try {
            return await this.model.findOne(filter, null, options).exec();
        } 
        catch (error) {
            logger.error("Error finding API key (findOne)", error);
            throw error;
        }
    }

    /** @inheritdoc */
    async find(
        filter: QueryFilter<IApiKey>,
        options?: QueryOptions<IApiKey>
    ): Promise<IApiKey[]> {
        try {
            return await this.model.find(filter, null, options).exec();
        } 
        catch (error) {
            logger.error("Error listing API keys", error);
            throw error;
        }
    }

    /** @inheritdoc */
    async countDocuments(filter: QueryFilter<IApiKey>): Promise<number> {
        try {
            return await this.model.countDocuments(filter).exec();
        } 
        catch (error) {
            logger.error("Error counting API keys", error);
            throw error;
        }
    }

    /** @inheritdoc */
    async findByKeyValue(
        keyValue: string,
        includeInactive = false
    ): Promise<IApiKey | null> {
        try {
            const filter: QueryFilter<IApiKey> = { keyValue };
            if (!includeInactive) {
                filter.isActive = true;
            }

            return await this.model.findOne(filter).populate("clientId").exec();
        } 
        catch (error) {
            logger.error("Error finding API key by value", error);
            throw error;
        }
    }

    /** @inheritdoc */
    async findByClientId(
        clientId: string,
        additionalFilter?: QueryFilter<IApiKey>
    ): Promise<IApiKey[]> {
        try {
            const query: QueryFilter<IApiKey> = {
                clientId,
                ...(additionalFilter ?? {}),
            };

            return await this.model
                .find(query)
                .populate("createdBy", "username email")
                .sort({ createdAt: -1 })
                .exec();
        } 
        catch (error) {
            logger.error("Error finding API keys by client", error);
            throw error;
        }
    }

    /** @inheritdoc */
    async countByClientId(
        clientId: string,
        additionalFilter?: QueryFilter<IApiKey>
    ): Promise<number> {
        try {
            const query: QueryFilter<IApiKey> = {
                clientId,
                ...(additionalFilter ?? {}),
            };

            return await this.model.countDocuments(query).exec();
        } 
        catch (error) {
            logger.error("Error counting API keys by client", error);
            throw error;
        }
    }
}

export default new MongoApiKeyRepository();
