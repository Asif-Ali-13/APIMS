/**
 * Analytics domain service: aggregates endpoint metrics from PostgreSQL roll-ups
 * into API-friendly DTOs (overall stats, top endpoints, time series).
 *
 * @module services/analytics/service/analyticsService
 */
import logger from "../../../shared/config/logger.ts";
import type { MetricsRepository } from "../../processor/repository/MetricsRepository.ts";

import type {
    OverallStatsDto,
    TimeSeriesPointDto,
    TopEndpointDto,
} from "../dto/analyticsResponseDto.ts";


/** Optional time bounds passed from controllers or internal callers. */
export interface AnalyticsTimeFilters {
    startTime?: number | Date | string | null;
    endTime?: number | Date | string | null;
}

/** Options for {@link AnalyticsService.getTopEndpoints}. */
export interface TopEndpointsOptions extends Pick<AnalyticsTimeFilters, "startTime"> {
    limit?: number;
}

/** Options for {@link AnalyticsService.getTimeSeries}. */
export interface TimeSeriesOptions extends AnalyticsTimeFilters {
    serviceName?: string;
    endpoint?: string;
    limit?: number;
}

/** Constructor dependencies for {@link AnalyticsService}. */
export interface AnalyticsServiceDeps {
    /** PostgreSQL metrics roll-up repository from the processor module. */
    metricsRepository: MetricsRepository;
}


/**
 * Reads aggregated endpoint metrics and maps repository rows to response DTOs.
 */
export class AnalyticsService {
    private readonly metricsRepository: MetricsRepository;

    /**
     * @param deps - Must include `metricsRepository`.
     * @throws Error if `metricsRepository` is missing.
     */
    constructor(deps: AnalyticsServiceDeps) {
        if (!deps?.metricsRepository) {
            throw new Error("metricsRepository is required");
        }
        this.metricsRepository = deps.metricsRepository;
    }

    /**
     * Returns high-level hit counts, error rate, latency, and uniqueness metrics.
     *
     * @param clientId - Tenant id; omit or pass `null` for cross-tenant (super admin) scope.
     * @param filters - Optional `startTime` / `endTime`; defaults to the last 24 hours.
     */
    async getOverallStats(
        clientId: string | null | undefined,
        filters: AnalyticsTimeFilters = {}
    ): Promise<OverallStatsDto> {
        
        try {
            const { startTime, endTime } = this.parseTimeFilters(filters);
            const stats = await this.metricsRepository.getOverallStats(
                clientId ?? undefined,
                startTime,
                endTime
            );

            const totalHits = parseInt(stats.total_hits ?? "0", 10) || 0;
            const errorHits = parseInt(stats.error_hits ?? "0", 10) || 0;
            const errorRate = totalHits > 0 ? (errorHits / totalHits) * 100 : 0;

            return {
                totalHits,
                errorHits,
                successHits: totalHits - errorHits,
                errorRate: parseFloat(errorRate.toFixed(2)),
                avgLatency: parseFloat(stats.avg_latency ?? "0") || 0,
                uniqueServices: parseInt(stats.unique_services ?? "0", 10) || 0,
                uniqueEndpoints: parseInt(stats.unique_endpoints ?? "0", 10) || 0,
                timeRange: {
                    start: startTime,
                    end: endTime,
                },
            };
        } 
        catch (error) {
            logger.error("Error getting overall stats", error);
            throw error;
        }
    }

    
    /**
     * Normalizes optional time filters; missing bounds default to the last 24 hours through now.
     */
    private parseTimeFilters(
        filters: AnalyticsTimeFilters = {}
    ): { startTime: Date; endTime: Date } {

        let { startTime, endTime } = filters;

        if (!startTime) {
            startTime = new Date();
            startTime.setHours(startTime.getHours() - 24);
        } 
        else startTime = new Date(startTime); 

        if (!endTime) endTime = new Date(); 
        else endTime = new Date(endTime); 

        return { startTime, endTime };
    }


    /**
     * Returns endpoints ordered by total hits within an optional start time.
     *
     * @param clientId - Tenant id; omit for global scope.
     * @param options - `limit` (default 10) and optional `startTime`.
     */
    async getTopEndpoints(
        clientId: string | null | undefined,
        options: TopEndpointsOptions = {}
    ): Promise<TopEndpointDto[]> {
        
        try {
            const { limit = 10, startTime } = options;
            const parsedStartTime = startTime ? new Date(startTime) : undefined;

            const endpoints = await this.metricsRepository.getTopEndpoints(
                clientId ?? undefined,
                limit,
                parsedStartTime
            );

            return endpoints.map((endpoint) => {
                const totalHits = parseInt(endpoint.total_hits, 10) || 0;
                const errorHits = parseInt(endpoint.error_hits, 10) || 0;
                const errorRate =
                    totalHits > 0 ? (errorHits / totalHits) * 100 : 0;

                return {
                    serviceName: endpoint.service_name,
                    endpoint: endpoint.endpoint,
                    method: endpoint.method,
                    totalHits,
                    avgLatency: parseFloat(endpoint.avg_latency ?? "0").toFixed(2),
                    errorHits,
                    errorRate: errorRate.toFixed(2),
                };
            });
        } 
        catch (error) {
            logger.error("Error getting top endpoints", error);
            throw error;
        }
    }


    /**
     * Returns bucketed endpoint metrics for charting or drill-down views.
     *
     * @param clientId - Tenant id; omit for global scope.
     * @param filters - Time range, optional service/endpoint filters, and row `limit`.
     */
    async getTimeSeries(
        clientId: string | null | undefined,
        filters: TimeSeriesOptions = {}
    ): Promise<TimeSeriesPointDto[]> {
        
        try {
            const { serviceName, endpoint, startTime, endTime, limit = 100 } = filters;
            const timeFilters: AnalyticsTimeFilters = {};

            if (startTime !== undefined) timeFilters.startTime = startTime;
            if (endTime !== undefined) timeFilters.endTime = endTime;

            const { startTime: parsedStart, endTime: parsedEnd } =
                this.parseTimeFilters(timeFilters);

            const metricsFilter: Parameters<MetricsRepository["getMetrics"]>[0] = {
                startTime: parsedStart,
                endTime: parsedEnd,
                limit,
            };

            if (clientId) metricsFilter.clientId = clientId;
            if (serviceName) metricsFilter.serviceName = serviceName;
            if (endpoint) metricsFilter.endpoint = endpoint;

            const metrics = await this.metricsRepository.getMetrics(metricsFilter);

            return metrics.map((metric) => ({
                serviceName: metric.service_name,
                endpoint: metric.endpoint,
                method: metric.method,
                totalHits: parseInt(metric.total_hits, 10) || 0,
                errorHits: parseInt(metric.error_hits, 10) || 0,
                avgLatency: parseFloat(metric.avg_latency ?? "0").toFixed(2),
                minLatency: parseFloat(metric.min_latency ?? "0").toFixed(2),
                maxLatency: parseFloat(metric.max_latency ?? "0").toFixed(2),
                timeBucket: metric.time_bucket,
            }));
        } 
        catch (error) {
            logger.error("Error getting time series", error);
            throw error;
        }
    }
}
