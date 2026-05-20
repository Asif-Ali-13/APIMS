import type { QueryResult, QueryResultRow } from "pg";
import { BaseRepository, type RepositoryLogger } from "./BaseRepository.ts";


const MAX_LIMIT = 1000;


/**
 * Minimal PostgreSQL query client contract (matches {@link PostgresConnection.query}).
 */
interface PostgresQueryClient {
    query<T extends QueryResultRow = QueryResultRow>(
        text: string,
        params?: unknown[]
    ): Promise<QueryResult<T>>;
}

/**
 * Constructor dependencies for {@link MetricsRepository}.
 */
interface MetricsRepositoryDeps {
    logger?: RepositoryLogger;
    postgres: PostgresQueryClient;
}


/**
 * Input shape for endpoint metrics upsert.
 */
export interface EndpointMetricsInput {
    clientId: string;
    serviceName: string;
    endpoint: string;
    method: string;
    totalHits: number;
    errorHits: number;
    avgLatency: number;
    minLatency: number;
    maxLatency: number;
    timeBucket: Date;
}

/**
 * Filters for grouped metrics listing.
 */
export interface MetricsFilter {
    clientId?: string;
    serviceName?: string;
    endpoint?: string;
    startTime?: Date;
    endTime?: Date;
    limit?: number;
    offset?: number;
}

/**
 * Aggregated endpoint metrics row.
 */
export interface EndpointMetricsRow extends QueryResultRow {
    service_name: string;
    endpoint: string;
    method: string;
    total_hits: string;
    error_hits: string;
    avg_latency: string | null;
    min_latency: string | null;
    max_latency: string | null;
    time_bucket: Date;
}

/**
 * Top endpoints row ordered by traffic.
 */
export interface TopEndpointRow extends QueryResultRow {
    service_name: string;
    endpoint: string;
    method: string;
    total_hits: string;
    avg_latency: string | null;
    error_hits: string;
}

/**
 * High-level aggregate statistics row.
 */
export interface OverallStatsRow extends QueryResultRow {
    total_hits: string | null;
    error_hits: string | null;
    avg_latency: string | null;
    unique_services: string;
    unique_endpoints: string;
}


/**
 * PostgreSQL repository that maintains roll-up endpoint metrics.
 */
export class MetricsRepository extends BaseRepository {
    private readonly postgres: PostgresQueryClient;

    constructor({ logger, postgres }: MetricsRepositoryDeps) {
        super({ logger });
        this.postgres = postgres;
    }

    /**
     * Inserts or merges endpoint metrics in a time bucket.
     */
    async upsertEndpointMetrics(metricsData: EndpointMetricsInput): Promise<void> {
        const {
            clientId,
            serviceName,
            endpoint,
            method,
            totalHits,
            errorHits,
            avgLatency,
            minLatency,
            maxLatency,
            timeBucket,
        } = metricsData;

        const sql = `
            INSERT INTO endpoint_metrics (
                client_id, service_name, endpoint, method, total_hits, error_hits,
                avg_latency, min_latency, max_latency, time_bucket
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            ON CONFLICT (client_id, service_name, endpoint, method, time_bucket)
            DO UPDATE SET
                total_hits = endpoint_metrics.total_hits + EXCLUDED.total_hits,
                error_hits = endpoint_metrics.error_hits + EXCLUDED.error_hits,
                avg_latency = (
                    (endpoint_metrics.avg_latency * endpoint_metrics.total_hits) +
                    (EXCLUDED.avg_latency * EXCLUDED.total_hits)
                ) / NULLIF((endpoint_metrics.total_hits + EXCLUDED.total_hits), 0),
                min_latency = LEAST(endpoint_metrics.min_latency, EXCLUDED.min_latency),
                max_latency = GREATEST(endpoint_metrics.max_latency, EXCLUDED.max_latency),
                updated_at = CURRENT_TIMESTAMP
        `;

        try {
            await this._query(sql, [
                clientId,
                serviceName,
                endpoint,
                method,
                totalHits,
                errorHits,
                avgLatency,
                minLatency,
                maxLatency,
                timeBucket,
            ]);
        } 
        catch (error: unknown) {
            this.logger.error("Error upserting endpoint metrics", { error });
            throw error;
        }
    }

    /**
     * Returns bucketed endpoint metrics with optional filters.
     */
    async getMetrics(filter: MetricsFilter = {}): Promise<EndpointMetricsRow[]> {
        const { 
            clientId, serviceName, endpoint, startTime, endTime, limit = 100, offset = 0 
        } = filter;

        const safeLimit = Math.min(Math.max(1, limit), MAX_LIMIT);
        const safeOffset = Math.max(0, offset);

        let sql = `
            SELECT
                service_name,
                endpoint,
                method,
                SUM(total_hits) as total_hits,
                SUM(error_hits) as error_hits,
                SUM(avg_latency * total_hits) / NULLIF(SUM(total_hits), 0) as avg_latency,
                MIN(min_latency) as min_latency,
                MAX(max_latency) as max_latency,
                time_bucket
            FROM endpoint_metrics
        `;

        const params: unknown[] = [];
        let paramIndex = 1;
        const whereConditions: string[] = [];

        if (clientId !== undefined) {
            whereConditions.push(`client_id = $${paramIndex++}`);
            params.push(clientId);
        }
        if (serviceName) {
            whereConditions.push(`service_name = $${paramIndex++}`);
            params.push(serviceName);
        }
        if (endpoint) {
            whereConditions.push(`endpoint = $${paramIndex++}`);
            params.push(endpoint);
        }
        if (startTime) {
            whereConditions.push(`time_bucket >= $${paramIndex++}`);
            params.push(startTime);
        }
        if (endTime) {
            whereConditions.push(`time_bucket <= $${paramIndex++}`);
            params.push(endTime);
        }

        if (whereConditions.length > 0) {
            sql += ` WHERE ${whereConditions.join(" AND ")}`;
        }

        sql += `
            GROUP BY service_name, endpoint, method, time_bucket
            ORDER BY time_bucket DESC
            LIMIT $${paramIndex}
            OFFSET $${paramIndex + 1}
        `;

        params.push(safeLimit, safeOffset);

        try {
            const result = await this._query<EndpointMetricsRow>(sql, params);
            return result.rows;
        } 
        catch (error: unknown) {
            this.logger.error("Error getting endpoint metrics", { error });
            throw error;
        }
    }

    /**
     * Returns top endpoints by total hit count.
     */
    async getTopEndpoints(
        clientId?: string, limit = 10, startTime?: Date
    ): Promise<TopEndpointRow[]> {

        const safeLimit = Math.min(Math.max(1, limit), MAX_LIMIT);
        let sql = `
            SELECT
                service_name,
                endpoint,
                method,
                SUM(total_hits) as total_hits,
                SUM(avg_latency * total_hits) / NULLIF(SUM(total_hits), 0) as avg_latency,
                SUM(error_hits) as error_hits
            FROM endpoint_metrics
        `;

        const params: unknown[] = [];
        let paramIndex = 1;
        const whereClauses: string[] = [];

        if (clientId !== undefined) {
            whereClauses.push(`client_id = $${paramIndex++}`);
            params.push(clientId);
        }
        if (startTime) {
            whereClauses.push(`time_bucket >= $${paramIndex++}`);
            params.push(startTime);
        }
        if (whereClauses.length > 0) {
            sql += ` WHERE ${whereClauses.join(" AND ")}`;
        }

        sql += `
            GROUP BY service_name, endpoint, method
            ORDER BY total_hits DESC
            LIMIT $${paramIndex}
        `;
        params.push(safeLimit);

        try {
            const result = await this._query<TopEndpointRow>(sql, params);
            return result.rows;
        } 
        catch (error: unknown) {
            this.logger.error("Error getting top endpoints", { error });
            throw error;
        }
    }

    /**
     * Returns global aggregate statistics for optional filters.
     */
    async getOverallStats(
        clientId?: string, startTime?: Date, endTime?: Date
    ): Promise<OverallStatsRow> {

        let sql = `
            SELECT
                SUM(total_hits) as total_hits,
                SUM(error_hits) as error_hits,
                SUM(avg_latency * total_hits) / NULLIF(SUM(total_hits), 0) as avg_latency,
                COUNT(DISTINCT service_name) as unique_services,
                COUNT(DISTINCT endpoint) as unique_endpoints
            FROM endpoint_metrics
        `;

        const params: unknown[] = [];
        let paramIndex = 1;
        const whereClauses: string[] = [];

        if (clientId !== undefined) {
            whereClauses.push(`client_id = $${paramIndex++}`);
            params.push(clientId);
        }
        if (startTime) {
            whereClauses.push(`time_bucket >= $${paramIndex++}`);
            params.push(startTime);
        }
        if (endTime) {
            whereClauses.push(`time_bucket <= $${paramIndex++}`);
            params.push(endTime);
        }

        if (whereClauses.length > 0) {
            sql += ` WHERE ${whereClauses.join(" AND ")}`;
        }

        try {
            const result = await this._query<OverallStatsRow>(sql, params);
            return result.rows[0] ?? {
                total_hits: null,
                error_hits: null,
                avg_latency: null,
                unique_services: "0",
                unique_endpoints: "0",
            };
        } 
        catch (error: unknown) {
            this.logger.error("Error getting overall stats", { error });
            throw error;
        }
    }

    /**
     * Executes a parameterized SQL query via the shared Postgres client.
     */
    private _query<T extends QueryResultRow = QueryResultRow>(
        sql: string,
        params: unknown[] = [],
        client: PostgresQueryClient = this.postgres
    ): Promise<QueryResult<T>> {
        
        const target = client ?? this.postgres;
        if (!target || typeof target.query !== "function") {
            
            const err = new Error("Postgres client not configured on MetricsRepository");
            this.logger.error("DB query error: Postgres client not configured");
            throw err;
        }

        return target.query<T>(sql, params);
    }
}
