import mongoose, { Connection } from "mongoose";
import config from "./index.ts"
import logger from "./logger.ts";

/**
 * Manages the lifecycle of a MongoDB connection using Mongoose.
 *
 * This class ensures:
 * - A single shared connection instance (singleton behavior)
 * - Safe connection reuse
 * - Graceful disconnection
 * - Centralized logging for connection events
 */
class MongoConnection {
    /**
     * Holds the active MongoDB connection instance.
     * Will be `null` if no connection is established.
     */
    private connection: Connection | null;

    /**
     * Initializes the MongoConnection instance.
     */
    constructor() {
        this.connection = null;
    }

    /**
     * Establishes a connection to MongoDB using Mongoose.
     * If a connection already exists, it reuses the existing one.
     * 
     * @returns { Promise<Connection> } The active MongoDB connection
     * 
     * @throws Will throw an error if the connection attempt fails
     */
    async connect(): Promise<Connection> {
        try {
            if(this.connection) {
                logger.info("MongoDB already connected!");
                return this.connection;
            }

            await mongoose.connect(config.mongo.uri, {
                dbName: config.mongo.dbName
            });
            
            this.connection = mongoose.connection;
            logger.info(`MongoDB connected ${config.mongo.uri}`);

            /**
             * Listen for runtime connection errors
             */
            this.connection.on("error", (err: Error) => {
                logger.error(`MongoDB connection error: ${err}`);
            });

            /**
             * Listen for disconnection events
             */
            this.connection.on("disconnected", () => {
                logger.error(`MongoDB disconnected`);
            })

            return this.connection;
        } 
        catch (error: unknown) {
            if(error instanceof Error) {
                logger.error(`Failed to Connect to MongoDB. error: ${error}`);
            }
            else logger.error(`Failed to Connect to MongoDB. Unknown error`);
            throw error;
        }
    }

    /**
     * Closes the active MongoDB connection.
     * If no connection exists, the method does nothing.
     *
     * @returns {Promise<void>}
     *
     * @throws Will throw an error if disconnection fails
     */
    async disconnect(): Promise<void> {
        try {
            if(this.connection) {
                await mongoose.disconnect();
                this.connection = null;
                logger.info(`MongoDb disconnected!`);
            }
        } 
        catch (error: unknown) {
            if(error instanceof Error) logger.error("Failed to disconnect MongoDB");
            else logger.error(`Failed to disconnect. Unknown error.`)
            throw error;
        }
    }

    /**
     * Returns the current MongoDB connection instance.
     *
     * @returns {Connection | null} The active connection, or `null` if not connected
     */
    getConnection(): Connection | null {
        return this.connection;
    }
}

export default new MongoConnection;
