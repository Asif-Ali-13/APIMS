import amqp from "amqplib";
import type { Channel, ChannelModel } from "amqplib";
import config from "./index.ts";
import logger from "./logger.ts";


/**
 * Represents the current state of the RabbitMQ connection.
 */
export enum RabbitMQStatus {
    CONNECTING = "connecting",
    CONNECTED = "connected",
    DISCONNECTED = "disconnected",
}

/**
 * RabbitMQ connection manager.
 * Handles connection lifecycle, channel creation, and queue setup.
 */
class RabbitMQConnection {

    /**
     * Active channel used for publishing/consuming messages.
     */
    private channel: Channel | null;
    private connection: ChannelModel | null;
    
    /**
     * Shared promise to prevent concurrent connection attempts.
     */
    private connecting: Promise<Channel> | null = null;
    private status: RabbitMQStatus;

    /**
     * Initializes the RabbitMQConnection.
     */
    constructor() {
        this.channel = null;
        this.connection = null;
        this.connecting = null;
        this.status = RabbitMQStatus.DISCONNECTED;
    }

    /**
     * Establishes a connection and channel to RabbitMQ.
     * Ensures only one connection attempt runs at a time.
     *
     * @returns { Promise<Channel> } Active RabbitMQ channel
     */
    public async connect(): Promise<Channel> {
        if (this.channel) {
            return this.channel;
        }

        if (this.connecting) {
            return this.connecting;
        }

        this.status = RabbitMQStatus.CONNECTING;

        this.connecting = (async (): Promise<Channel> => {
            try {
                logger.info(`Connecting to RabbitMQ`, { url: config.rabbitmq.url });

                this.connection = await amqp.connect(config.rabbitmq.url);
                this.channel = await this.connection.createChannel();

                if (!this.channel) {
                    throw new Error("Failed to create RabbitMQ channel");
                }

                const queueName = config.rabbitmq.queue;
                const dlqName = `${queueName}.dlq`;

                // Dead Letter Queue
                await this.channel.assertQueue(dlqName, { durable: true });

                // Main Queue
                await this.channel.assertQueue(queueName, {
                    durable: true,
                    arguments: {
                        "x-dead-letter-exchange": "",
                        "x-dead-letter-routing-key": dlqName,
                    },
                });

                // Event listeners
                this.connection.on("close", () => {
                    logger.warn(`RabbitMQ connection closed`);
                    this.reset();
                });

                this.connection.on("error", (err: Error) => {
                    logger.error(`RabbitMQ connection error`, { error: err });
                    this.reset();
                });

                this.status = RabbitMQStatus.CONNECTED;
                logger.info(`RabbitMQ connected`, { queue: queueName });

                return this.channel;
            } 
            catch (error: unknown) {
                this.reset();

                if (error instanceof Error) logger.error(`Failed to connect to RabbitMQ`, { error });
                else logger.error(`Failed to connect to RabbitMQ: Unknown error`);
                throw error;
            } 
            finally { this.connecting = null; }
            
        })();

        return this.connecting;
    }

    /**
     * Returns the current channel if available.
     * 
     * @returns { Channel | null } 
     */
    getChannel(): Channel | null {
        return this.channel;
    }

    /**
     * Returns the current connection status.
     * 
     * @returns { RabbitMQStatus }
     */
    getStatus(): RabbitMQStatus {
        return this.status;
    }

    /**
     * Gracefully closes the channel and connection.
     * 
     * @returns { Promise<void> }
     */
    async close(): Promise<void> {
        try {
            if(this.channel) {
                await this.channel.close();
                this.channel = null;
            }

            if(this.connection) {
                await this.connection.close();
                this.connection = null;
            }

            logger.info(`RabbitMQ connection closed`);
        } 
        catch (error: unknown) {
            if(error instanceof Error) logger.error(`Failed to close RabbitMQ. Error: ${ error }`);
            else logger.error(`Failed to close RabbitMQ. Unknown Error.`)
            throw error;
        }
    }

    /**
     * Resets internal state after connection failure or closure.
     */
    private reset(): void {
        this.connection = null;
        this.channel = null;
        this.status = RabbitMQStatus.DISCONNECTED;
    }
}

export default new RabbitMQConnection();
