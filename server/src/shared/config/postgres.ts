import { Pool, PoolClient, QueryResult, QueryResultRow } from "pg";
import config from "./index.ts"
import logger from "./logger.ts";


/**
 * Singleton-style PostgreSQL connection manager.
 * Provides pooled access, query execution, and lifecycle management.
 */
class PostgresConnection {
    /**
     * Internal connection pool instance.
     */
    private pool: Pool | null;

    /**
     * Initializes the PostgresConnection instance.
     */
    constructor() {
        this.pool = null;
    }

    /**
     * Returns a singleton PostgreSQL connection pool.
     * Initializes the pool if it does not already exist.
     * 
     * @returns { Pool } Active PostgreSQL pool instance
     */
    getPool(): Pool {
        if(!this.pool) {
            this.pool = new Pool({
                host: config.postgres.host,
                port: config.postgres.port,
                user: config.postgres.user,
                database: config.postgres.database,
                password: config.postgres.password,
                max: 20,    // Maximum concurrent connections
                idleTimeoutMillis: 30000,
                connectionTimeoutMillis: 2000,
            });

            this.pool.on("error", (err: Error) => {
                logger.error(`UnExpected Error on idle PG client connection. Error: ${err}`);
            });
            
            logger.info(`PG Pool Created`);
        }

        return this.pool;
    }

    /**
     * Tests database connectivity by executing a simple query.
     *
     * @throws { Error } If connection fails
     */
    async testConnection(): Promise<void> {
        const pool: Pool = this.getPool();
        let client: PoolClient | null = null;

        try {
            client = await pool.connect();
            const result = await client.query<{ now: string }>("SELECT NOW()");    // returns time
            
            logger.info(`Postgres Connection Successful`, { timestamp: result.rows[0].now });
        } 
        catch (error: unknown) {
            if(error instanceof Error) logger.error(`Failed to connect to PG. Error: ${ error }`);
            else logger.error(`Failed to connect to PG. Unknown Error.`)
            throw error;
        }
        finally { client?.release(); }
    }

    /**
     * Executes a parameterized SQL query.
     *
     * @template T - Expected row result type
     * @param { string } text - SQL query string
     * @param { unknown[] } [params] - Query parameters
     * @returns { Promise<QueryResult<T>> } Query result
     *
     * @example
     * const result = await db.query<{ id: number }>(
     *   "SELECT id FROM users WHERE id = $1",
     *   [1]
     * );
     */
    async query<T extends QueryResultRow = QueryResultRow>(
        text: string,
        params?: unknown[]
    ): Promise<QueryResult<T>> {

        const pool: Pool = this.getPool();
        const start: number = Date.now();
        try {
            const result = await pool.query<T>(text, params);    
            const duration: number = Date.now() - start;
            
            logger.debug(`Query Executed`, { text, duration, rows: result.rowCount });
            return result;
        } 
        catch (error: unknown) {
            if(error instanceof Error) logger.error(`Failed to Query. Error: ${ error }`);
            else logger.error(`Failed to Query. Unknown Error.`)
            throw error;
        }
    }

    /**
     * Gracefully shuts down the PostgreSQL connection pool.
     *
     * @returns { Promise<void> }
     */
    async close(): Promise<void>  {
        if(this.pool) {
            await this.pool.end();
            this.pool = null;
            logger.info(`PG close successfully`);
        }
    }
}

export default new PostgresConnection();
