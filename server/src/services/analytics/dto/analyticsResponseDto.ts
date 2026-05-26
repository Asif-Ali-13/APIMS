/**
 * Public DTOs returned by analytics HTTP handlers and {@link AnalyticsService}.
 *
 * @module services/analytics/dto/analyticsResponseDto
 */

/** Inclusive time window used in analytics responses. */
export interface AnalyticsTimeRangeDto {
    start: Date;
    end: Date;
}

/** Aggregate hit statistics for a client or global scope. */
export interface OverallStatsDto {
    totalHits: number;
    errorHits: number;
    successHits: number;
    errorRate: number;
    avgLatency: number;
    uniqueServices: number;
    uniqueEndpoints: number;
    timeRange: AnalyticsTimeRangeDto;
}

/** Endpoint ranked by traffic within a time window. */
export interface TopEndpointDto {
    serviceName: string;
    endpoint: string;
    method: string;
    totalHits: number;
    avgLatency: string;
    errorHits: number;
    errorRate: string;
}

/** Bucketed endpoint metrics suitable for time-series charts. */
export interface TimeSeriesPointDto {
    serviceName: string;
    endpoint: string;
    method: string;
    totalHits: number;
    errorHits: number;
    avgLatency: string;
    minLatency: string;
    maxLatency: string;
    timeBucket: Date;
}

/** Combined payload for the analytics dashboard route. */
export interface AnalyticsDashboardDto {
    stats: OverallStatsDto | null;
    topEndpoints: TopEndpointDto[] | null;
    recentActivity: TimeSeriesPointDto[] | null;
}
