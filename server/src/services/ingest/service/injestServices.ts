import type { Types } from "mongoose";
import { v4 as uuidv4 } from "uuid";

import logger from "../../../shared/config/logger.ts";
import AppError from "../../../shared/utils/appError.ts";
import type { EventProducer } from "../../../shared/events/producer/eventProducer.ts";


type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "OPTIONS" | "HEAD";

export interface IngestApiHitInput {
    serviceName: string;
    endpoint: string;
    method: string;
    statusCode: number | string;
    latencyMs: number | string;
    clientId: string | Types.ObjectId;
    apiKeyId?: string | Types.ObjectId;
    ip?: string;
    userAgent?: string;
}

export interface ApiHitEvent {
    eventId: string;
    timestamp: Date;
    serviceName: string;
    endpoint: string;
    method: HttpMethod;
    statusCode: number;
    latencyMs: number;
    clientId: string;
    apiKeyId?: string;
    ip: string;
    userAgent: string;
}

export interface IngestQueuedResult {
    eventId: string;
    status: "queued";
    timestamp: Date;
}

export interface IngestRejectedResult {
    eventId: string;
    status: "rejected";
    reason: "service_unavailable";
    timestamp: Date;
}

export type IngestResult = IngestQueuedResult | IngestRejectedResult;

interface IngestServiceDeps {
    eventProducer: EventProducer;
}


function toNumber(value: string | number): number {
    return typeof value === "number" ? value : Number(value);
}

function toHttpMethod(value: string): HttpMethod {
    const normalized = value.toUpperCase();
    const validMethods: readonly string[] = ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"];
    if (!validMethods.includes(normalized)) {
        throw new AppError(`Invalid HTTP methods: ${value} `, 400);
    }
    return normalized as HttpMethod;
}


/**
 * Service class responsible for handling the business logic of ingesting API hit data. 
 * The IngestService class takes an EventProducer as a dependency, which is used to 
 * publish API hit events to RabbitMQ. The ingestApiHit method validates the incoming hit
 * data, constructs an event object, and attempts to publish it using the EventProducer. 
 * If the circuit breaker rejects the request, it returns a response indicating that 
 * the service is temporarily unavailable. The validateHitData method ensures that 
 * all required fields are present and valid before processing the hit data.
 * 
 * @class IngestService
 * @constructor
 * @param {Object} dependencies - The dependencies required by the IngestService.
 * @param {EventProducer} dependencies.eventProducer - The event producer instance for publishing events to RabbitMQ.
 */
export class IngestService {
    private readonly eventProducer: EventProducer;

    constructor({ eventProducer }: IngestServiceDeps) {
        if (!eventProducer) throw new Error('IngestService requires eventProducer');
        this.eventProducer = eventProducer;
    }

    /**
     * Ingests an API hit by validating the hit data and publishing an event to RabbitMQ.
     * @param {Object} hitData - The API hit data to be ingested.
     * @returns {Promise<Object>} - The result of the ingestion, including the event ID and status.
     */
    async ingestApiHit(hitData: IngestApiHitInput): Promise<IngestResult> {
        try {
            this.validateHitData(hitData);
            const method = toHttpMethod(hitData.method);
            const statusCode = toNumber(hitData.statusCode);
            const latencyMs = toNumber(hitData.latencyMs);

            const eventBase = {
                eventId: uuidv4(),
                timestamp: new Date(),
                serviceName: hitData.serviceName,
                endpoint: hitData.endpoint,
                method,
                statusCode,
                latencyMs,
                clientId: String(hitData.clientId),
                ip: hitData.ip || 'unknown',
                userAgent: hitData.userAgent || '',
            };

            const event: ApiHitEvent = hitData.apiKeyId
                ? { ...eventBase, apiKeyId: String(hitData.apiKeyId) }
                : eventBase;

            const published = await this.eventProducer.publishApiHit(event);

            if (!published) {
                // Circuit breaker rejected the request
                logger.warn('API hit rejected by circuit breaker', {
                    eventId: event.eventId,
                    endpoint: event.endpoint,
                    method: event.method,
                    clientId: event.clientId,
                });

                const rejectedResult: IngestRejectedResult = {
                    eventId: event.eventId,
                    status: 'rejected',
                    reason: 'service_unavailable',
                    timestamp: event.timestamp,
                };
                return rejectedResult;
            }

            logger.info('API hit ingested', {
                eventId: event.eventId,
                endpoint: event.endpoint,
                method: event.method,
                clientId: event.clientId,
            });

            const queuedResult: IngestQueuedResult = {
                eventId: event.eventId,
                status: 'queued',
                timestamp: event.timestamp,
            };

            return queuedResult;
        } 
        catch (error) {
            logger.error('Error ingesting API hit:', error);
            throw error;
        }
    }

    /**
     * Validates the API hit data to ensure all required fields are present and valid.
     * @param {Object} hitData - The API hit data to be validated.
     * @throws {AppError} - If any required fields are missing or invalid.
     */
    validateHitData(hitData: IngestApiHitInput): void {
        const missingFields: string[] = [];

        if (!hitData.serviceName) missingFields.push("serviceName");
        if (!hitData.endpoint) missingFields.push("endpoint");
        if (!hitData.method) missingFields.push("method");
        
        if (
            hitData.statusCode === undefined || 
            hitData.statusCode === null      || 
            hitData.statusCode === ""
        ) { missingFields.push("statusCode"); }

        if (
            hitData.latencyMs === undefined || 
            hitData.latencyMs === null      || 
            hitData.latencyMs === ""
        ) { missingFields.push("latencyMs"); }
        
        if (!hitData.clientId) missingFields.push("clientId");

        if (missingFields.length > 0) {
            throw new AppError(`Missing required fields: ${missingFields.join(",")}`, 400)
        };

        toHttpMethod(hitData.method);

        const statusCode = toNumber(hitData.statusCode);
        if (isNaN(statusCode) || statusCode < 100 || statusCode > 599) {
            throw new AppError(`Invalid Status code : ${hitData.statusCode} `, 400)
        };

        const latency = toNumber(hitData.latencyMs);
        if (isNaN(latency) || latency < 0) {
            throw new AppError(`Invalid latency : ${hitData.latencyMs} `, 400)
        }
    }
}