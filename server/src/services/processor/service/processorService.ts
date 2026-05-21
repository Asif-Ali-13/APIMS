import { Types } from "mongoose";
import logger from "../../../shared/config/logger.ts";
import { HttpMethod, type IApiHit } from "../../../shared/models/ApiHits.ts";
import type { ApiHitRepository } from "../repository/ApiHitRepository.ts";
import type { EndpointMetricsInput, MetricsRepository } from "../repository/MetricsRepository.ts";


/**
 * Supported aggregation bucket intervals.
 */
type TimeBucketInterval = "minute" | "hour" | "day";


/**
 * Raw event payload received from queue for processing.
 */
export interface ProcessorEventData {
    eventId: string;
    timestamp: Date | string | number;
    serviceName: string;
    endpoint: string;
    method: string;
    statusCode: number;
    latencyMs: number;
    clientId: string;
    apiKeyId?: string;
    ip: string;
    userAgent?: string;
}

interface ProcessorServiceDeps {
    apiHitRepository: ApiHitRepository;
    metricsRepository: MetricsRepository;
}

/**
 * Handles queue events by persisting raw hits and updating aggregated metrics.
 *
 * @module services/processor/service/processorService
 */
export class ProcessorService {
    private readonly apiHitRepository: ApiHitRepository;
    private readonly metricsRepository: MetricsRepository;

    constructor({ apiHitRepository, metricsRepository }: ProcessorServiceDeps) {
        if (!apiHitRepository || !metricsRepository) {
            throw new Error("ProcessorService requires apiHitRepository and metricsRepository");
        }
        this.apiHitRepository = apiHitRepository;
        this.metricsRepository = metricsRepository;
    }

    /**
     * Buckets a timestamp into minute/hour/day resolution.
     */
    getTimeBucket(
        timestamp: Date | string | number, interval: TimeBucketInterval = "hour"
    ): Date {
        const date = new Date(timestamp);
        switch (interval) {
            case "minute":
                date.setSeconds(0, 0);
                break;
            case "day":
                date.setHours(0, 0, 0, 0);
                break;
            case "hour":
            default:
                date.setMinutes(0, 0, 0);
                break;
        }
        return date;
    }

    /**
     * Persists a raw API hit and updates metrics.
     *
     * Raw event persistence is treated as critical and must succeed. Metrics update
     * is best-effort and logged as non-critical failure.
     */
    async processEvent(eventData: ProcessorEventData): Promise<void> {
        let rawEventSaved = false;

        try {
            logger.info("Processing event data", {
                eventId: eventData.eventId,
                clientId: eventData.clientId,
                serviceName: eventData.serviceName,
                endpoint: eventData.endpoint,
                method: eventData.method,
            });

            const doc: Partial<IApiHit> = {
                eventId: eventData.eventId,
                timestamp: new Date(eventData.timestamp),
                serviceName: eventData.serviceName,
                endpoint: eventData.endpoint,
                method: eventData.method as HttpMethod,
                statusCode: eventData.statusCode,
                latencyMs: eventData.latencyMs,
                clientId: new Types.ObjectId(eventData.clientId),
                ip: eventData.ip,
            };

            if (eventData.userAgent !== undefined) {
                doc.userAgent = eventData.userAgent;
            }
            if (eventData.apiKeyId !== undefined) {
                doc.apiKeyId = new Types.ObjectId(eventData.apiKeyId);
            }

            await this.apiHitRepository.save(doc);
            rawEventSaved = true;
            logger.info("Raw event saved to MongoDB", { eventId: eventData.eventId });

            await this._updateMetricsWithFallback(eventData);
            logger.info("Event processed successfully", { eventId: eventData.eventId });
        } 
        catch (error: unknown) {
            const errMessage = error instanceof Error ? error.message : "Unknown error";
            if (!rawEventSaved) {
                logger.error("Critical: failed to save raw event to MongoDB", {
                    error: errMessage,
                    eventId: eventData.eventId,
                });
                throw error;
            }

            logger.error("Non-critical: raw event saved but metrics update failed", {
                error: errMessage,
                eventId: eventData.eventId,
            });
        }
    }

    /**
     * Updates PostgreSQL endpoint metrics for one event.
     */
    private async _updateMetricsWithFallback(eventData: ProcessorEventData): Promise<void> {
        const latencyMs = Number(eventData.latencyMs);
        const metricsData: EndpointMetricsInput = {
            clientId: String(eventData.clientId),
            serviceName: eventData.serviceName,
            endpoint: eventData.endpoint,
            method: eventData.method,
            totalHits: 1,
            errorHits: eventData.statusCode >= 400 ? 1 : 0,
            avgLatency: latencyMs,
            minLatency: latencyMs,
            maxLatency: latencyMs,
            timeBucket: this.getTimeBucket(eventData.timestamp, "hour"),
        };

        try {
            await this.metricsRepository.upsertEndpointMetrics(metricsData);
            logger.info("Metrics updated successfully", { eventId: eventData.eventId });
        } 
        catch (error) { throw error; }        
    }

    /**
     * Removes old raw hit documents from MongoDB.
     */
    async cleanupOldEvents(daysToKeep = 30): Promise<number> {
        try {
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
            return await this.apiHitRepository.deleteOldHits(cutoffDate);
        } 
        catch (error: unknown) {
            logger.error("Error during cleanup", { error });
            throw error;
        }
    }
}