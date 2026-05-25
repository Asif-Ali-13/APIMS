import { z } from "zod";
import type { Channel, ConsumeMessage, Message } from "amqplib";
import type { ProcessorEventData } from "./service/processorService.ts";

import config from "../../shared/config/index.ts";
import logger from "../../shared/config/logger.ts";
import mongodb from "../../shared/config/mongodb.ts";
import postgres from "../../shared/config/postgres.ts";
import rabbitmq from "../../shared/config/rabbitmq.ts";
import processorContainer from "./Dependencies/dependencies.ts";

import { EVENT_TYPES } from "../../shared/events/eventContracts.ts";
import { CircuitBreaker } from "../../shared/events/producer/CircuitBreaker.ts";
import { RetryStrategy, isRetryable } from "../../shared/events/producer/RetryStrategy.ts";


/**
 * Runtime-safe schema for queue messages.
 */
const messageSchema = z.object({
    type: z.enum([EVENT_TYPES.API_HIT]),
    data: z.record(z.string(), z.unknown()),
    messageId: z.string().optional(),
    timestamp: z.union([z.string(), z.number()]).optional(),
});


interface ConsumerLogger {
    info: (message: string, meta?: unknown) => void;
    warn: (message: string, meta?: unknown) => void;
    error: (message: string, meta?: unknown) => void;
    debug: (message: string, meta?: unknown) => void;
}

interface ConsumerStats {
    processed: number;
    failed: number;
    retried: number;
    dlqRouted: number;
    lastProcessedAt: Date | null;
}

interface ParsedQueueMessage {
    type: (typeof EVENT_TYPES)[keyof typeof EVENT_TYPES];
    data: ProcessorEventData;
    messageId: string;
    retryCount: number;
}

interface RabbitMQClient {
    connect: () => Promise<Channel>;
    close: () => Promise<void>;
}

interface MongoClient {
    connect: () => Promise<unknown>;
    disconnect: () => Promise<void>;
}

interface PostgresClient {
    testConnection: () => Promise<void>;
    close: () => Promise<void>;
}

interface ProcessorServiceContract {
    processEvent: (eventData: ProcessorEventData) => Promise<void>;
}

interface ConsumerDeps {
    processorService: ProcessorServiceContract;
    rabbitmq: RabbitMQClient;
    mongodb: MongoClient;
    postgres: PostgresClient;
    config: typeof config;
    logger: ConsumerLogger;
    retryStrategy: RetryStrategy;
    circuitBreaker: CircuitBreaker;
}


/**
 * Winston JSON transport does not serialize `Error` enumerable fields well; use plain objects.
 */
function loggableError(error: unknown): Record<string, string | undefined> {
    if (error instanceof Error) {
        return { name: error.name, message: error.message, stack: error.stack };
    }
    return { message: String(error) };
}


/**
 * Consumes API hit events from RabbitMQ and persists them via ProcessorService.
 *
 * @module services/processor/consumer
 */
class EventConsumer {
    private readonly _processorService: ProcessorServiceContract;
    private readonly _rabbitmq: RabbitMQClient;
    private readonly _mongodb: MongoClient;
    private readonly _postgres: PostgresClient;
    private readonly _config: typeof config;
    private readonly _logger: ConsumerLogger;
    private readonly _retryStrategy: RetryStrategy;
    private readonly _circuitBreaker: CircuitBreaker;
    private readonly _maxRetries: number;

    private isRunning: boolean;
    private channel: Channel | null;
    private readonly _stats: ConsumerStats;
    private readonly _processedIds: Set<string>;
    private readonly _poisonMessages: Map<string, number>;

    constructor({
        processorService,
        rabbitmq: rabbit,
        mongodb: mongo,
        postgres: pg,
        config: appConfig,
        logger: appLogger,
        retryStrategy,
        circuitBreaker,
    }: ConsumerDeps) {
        this._processorService = processorService;
        this._rabbitmq = rabbit;
        this._mongodb = mongo;
        this._postgres = pg;
        this._config = appConfig;
        this._logger = appLogger;
        this._retryStrategy = retryStrategy;
        this._circuitBreaker = circuitBreaker;
        this._maxRetries = appConfig.rabbitmq.retryAttempts;

        this.isRunning = false;
        this.channel = null;
        this._stats = { 
            processed: 0, failed: 0, retried: 0, dlqRouted: 0, lastProcessedAt: null 
        };
        this._processedIds = new Set<string>();
        this._poisonMessages = new Map<string, number>();
    }

    /**
     * Starts the consumer and subscribes to queue messages.
     */
    async start(): Promise<void> {
        try {
            await this._connectDatabases();
            await this._initChannelAndConsume();
            this._logger.info("Event consumer is running");
        } 
        catch (error: unknown) {
            this._logger.error("Failed to start consumer", { err: loggableError(error) });
            await this._cleanup();
            throw error;
        }
    }

    /**
     * Stops consumption and closes active channel.
     */
    private async _cleanup(): Promise<void> {
        try {
            this.isRunning = false;
            if (this.channel) {
                await this.channel.close();
                this.channel = null;
            }
        } 
        catch (error: unknown) {
            this._logger.error("Error during cleanup", { err: loggableError(error) });
        }
    }

    /**
     * Connects MongoDB and PostgreSQL with retry loop.
     */
    private async _connectDatabases(): Promise<void> {
        const maxRetries = 5;
        let retries = 0;

        while (retries < maxRetries) {
            try {
                this._logger.info("Connecting to databases...");
                await Promise.all([this._mongodb.connect(), this._postgres.testConnection()]);
                this._logger.info("Database connections established");
                return;
            } 
            catch (error: unknown) {
                retries += 1;
                this._logger.error(`Database connection attempt ${retries} failed`, { err: loggableError(error) });
                if (retries >= maxRetries) {
                    throw new Error(`Failed to connect to databases after ${maxRetries} attempts`);
                }
                await new Promise<void>((resolve) => setTimeout(resolve, 5000 * retries));
            }
        }
    }

    /**
     * Initializes RabbitMQ channel and queue subscription.
     */
    private async _initChannelAndConsume(): Promise<void> {
        this.channel = await this._rabbitmq.connect();
        const prefetch = 10;
        this.channel.prefetch(prefetch);

        this.channel.on("error", (err: Error) => {
            this._logger.error("Consumer channel error", { err: loggableError(err) });
            this._circuitBreaker.onFailure();
        });

        this.channel.on("close", () => {
            this._logger.warn("Consumer channel closed unexpectedly");
            if (this.isRunning) { void this._reconnect(); }
        });

        this._logger.info(`Started consuming from queue: ${this._config.rabbitmq.queue}`);
        this.isRunning = true;

        await this.channel.consume(
            this._config.rabbitmq.queue,
            async (msg: ConsumeMessage | null) => {
                if (msg) { await this._handleMessage(msg); }
            },
            { noAck: false, consumerTag: `consumer-${Date.now()}` }
        );
    }

    /**
     * Reconnects to RabbitMQ and resumes consumption.
     */
    private async _reconnect(): Promise<void> {
        try {
            await new Promise<void>((resolve) => setTimeout(resolve, 5000));
            await this._initChannelAndConsume();
        } 
        catch (error: unknown) {
            this._logger.error("Failed to reconnect", { err: loggableError(error) });
            if (this.isRunning) {
                setTimeout(() => {
                    void this._reconnect();
                }, 10_000);
            }
        }
    }

    /**
     * Handles one consumed queue message end-to-end.
     */
    private async _handleMessage(msg: ConsumeMessage): Promise<void> {
        if (!this.channel) {
            throw new Error("Consumer channel is not initialized");
        }

        if (!this._circuitBreaker.allowRequest()) {
            this._logger.warn("Circuit breaker open, requeuing message");
            this.channel.nack(msg, false, true);
            return;
        }

        let messageData: ParsedQueueMessage | null = null;
        try {
            messageData = this._parseMessage(msg);

            if (this._processedIds.has(messageData.messageId)) {
                this._logger.debug("Duplicate message skipped", { messageId: messageData.messageId });
                this.channel.ack(msg);
                return;
            }

            await this._processMessage(messageData);
            this.channel.ack(msg);
            this._circuitBreaker.onSuccess();

            this._stats.processed += 1;
            this._stats.lastProcessedAt = new Date();
            this._markAsProcessed(messageData.messageId);
            this._poisonMessages.delete(messageData.type);
        } 
        catch (error: unknown) {
            await this._handleProcessingError(error, msg, messageData);
        }
    }

    /**
     * Parses and validates one AMQP message.
     */
    private _parseMessage(msg: Message): ParsedQueueMessage {
        try {
            const content = msg.content.toString();
            const messageData = JSON.parse(content);
            const parsed = messageSchema.safeParse(messageData);

            if (!parsed.success) {
                const issueText = parsed.error.issues.map((issue) => issue.message).join(", ");
                throw new Error(`Schema validation failed: ${issueText}`);
            }

            return {
                type: parsed.data.type,
                data: parsed.data.data as unknown as ProcessorEventData,
                messageId: msg.properties.messageId ?? parsed.data.messageId ?? "unknown",
                retryCount: Number(msg.properties.headers?.["x-retry-count"] ?? 0),
            };
        } 
        catch (error: unknown) {
            const message = error instanceof Error ? error.message : "Unknown parse error";
            throw new Error(`Message parsing failed: ${message}`);
        }
    }

    /**
     * Dispatches parsed message to service handlers.
     */
    private async _processMessage(messageData: ParsedQueueMessage): Promise<void> {
        switch (messageData.type) {
            case EVENT_TYPES.API_HIT:
                await this._processorService.processEvent(messageData.data);
                break;
            default:
                throw new Error(`Unknown event type: ${messageData.type}`);
        }
    }

    /**
     * Handles processing failures with retry/DLQ strategy.
     */
    private async _handleProcessingError(
        error: unknown,
        msg: ConsumeMessage,
        messageData: ParsedQueueMessage | null
    ): Promise<void> {
        const messageId = messageData?.messageId ?? msg.properties.messageId ?? "unknown";
        const retryCount = messageData?.retryCount ?? 0;

        this._circuitBreaker.onFailure();
        this._stats.failed += 1;

        const eventType = messageData?.type ?? "unknown";
        const poisonCount = (this._poisonMessages.get(eventType) ?? 0) + 1;
        this._poisonMessages.set(eventType, poisonCount);

        if (poisonCount >= 10) {
            this._logger.error("Poison message pattern detected", {
                eventType,
                consecutiveFailures: poisonCount,
            });
        }

        this._logger.error("Message processing failed", {
            messageId,
            retryCount,
            err: loggableError(error),
        });

        if (!isRetryable(error) || !this._retryStrategy.shouldRetry(retryCount)) {
            const reason = retryCount >= this._maxRetries ? "MAX_RETRIES_EXCEEDED" : "NON_RETRYABLE";
            await this._sendToDLQ(msg, error, reason);
            return;
        }

        await this._retryMessage(msg, retryCount);
    }

    /**
     * Routes a message to DLQ and acknowledges original message.
     */
    private async _sendToDLQ(
        msg: ConsumeMessage, error: unknown, reason: string
    ): Promise<void> {
        if (!this.channel) {
            throw new Error("Cannot route to DLQ: channel unavailable");
        }

        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        try {
            const dlqName = `${this._config.rabbitmq.queue}.dlq`;
            this.channel.sendToQueue(dlqName, msg.content, {
                ...msg.properties,
                persistent: true,
                headers: {
                    ...msg.properties.headers,
                    "x-dlq-reason": reason,
                    "x-dlq-error": errorMessage,
                    "x-dlq-timestamp": Date.now(),
                    "x-original-queue": this._config.rabbitmq.queue,
                },
            });

            this.channel.ack(msg);
            this._stats.dlqRouted += 1;
        } 
        catch (dlqError: unknown) {
            this._logger.error("Failed to send message to DLQ", { err: loggableError(dlqError) });
            this.channel.nack(msg, false, false);
        }
    }

    /**
     * Schedules retry by re-publishing message with retry headers.
     */
    private async _retryMessage(msg: ConsumeMessage, retryCount: number): Promise<void> {
        if (!this.channel) {
            throw new Error("Cannot retry message: channel unavailable");
        }

        const delay = this._retryStrategy.delay(retryCount);
        const retryHeaders = {
            ...msg.properties.headers,
            "x-retry-count": retryCount + 1,
            "x-retry-timestamp": Date.now(),
            "x-retry-delay": delay,
            "x-original-queue": this._config.rabbitmq.queue,
        };

        setTimeout(() => {
            try {
                this.channel?.sendToQueue(this._config.rabbitmq.queue, msg.content, {
                    ...msg.properties,
                    headers: retryHeaders,
                });

                this._logger.info("Message scheduled for retry", {
                    messageId: msg.properties.messageId,
                    retryCount: retryCount + 1,
                    delay,
                });
            } 
            catch (error: unknown) {
                this._logger.error("Failed to schedule retry", { err: loggableError(error) });
                void this._sendToDLQ(msg, error, "RETRY_FAILED");
            }
        }, delay);

        this.channel.ack(msg);
        this._stats.retried += 1;
    }

    /**
     * Tracks message IDs to keep consumer idempotent.
     */
    private _markAsProcessed(messageId: string): void {
        this._processedIds.add(messageId);
        if (this._processedIds.size > 100_000) {
            const first = this._processedIds.values().next().value;
            if (first) { this._processedIds.delete(first); }
        }
    }

    /**
     * Stops the consumer and disconnects external dependencies.
     */
    async stop(): Promise<void> {
        try {
            await this._cleanup();
            await Promise.all([
                this._rabbitmq.close(), this._mongodb.disconnect(), this._postgres.close()
            ]);
        } 
        catch (error: unknown) {
            this._logger.error("Error stopping consumer", { err: loggableError(error) });
        }
    }
}


const retryStrategy = new RetryStrategy({
    maxRetries: config.rabbitmq.retryAttempts,
    baseDelayMs: config.rabbitmq.retryDelay,
    maxDelayMs: 30_000,
    jitterFactor: 0.3,
});

const circuitBreaker = new CircuitBreaker({
    failureThreshold: 5,
    cooldownMs: 30_000,
    halfOpenMaxAttempts: 3,
    logger,
});

const consumer = new EventConsumer({
    processorService: processorContainer.services.processorService,
    rabbitmq,
    mongodb,
    postgres,
    config,
    logger,
    retryStrategy,
    circuitBreaker,
});


/**
 * Boots the consumer with retry protection.
 */
async function startConsumerWithRetry(): Promise<void> {
    const startupRetry = new RetryStrategy({ 
        maxRetries: 5, baseDelayMs: 5000, maxDelayMs: 30_000 
    });
    let attempt = 0;

    while (startupRetry.shouldRetry(attempt) || attempt === 0) {
        try {
            logger.info(`Starting consumer (attempt ${attempt + 1})`);
            await consumer.start();
            logger.info("Consumer started successfully");
            return;
        } 
        catch (error: unknown) {
            attempt += 1;
            logger.error(`Consumer start attempt ${attempt} failed`, { err: loggableError(error) });

            if (!startupRetry.shouldRetry(attempt)) {
                logger.error("Max retries reached, exiting...");
                process.exit(1);
            }

            await startupRetry.wait(attempt - 1);
        }
    }
}


process.on("SIGINT", async () => {
    logger.info("Received SIGINT, shutting down gracefully...");
    await consumer.stop();
    process.exit(0);
});

process.on("SIGTERM", async () => {
    logger.info("Received SIGTERM, shutting down gracefully...");
    await consumer.stop();
    process.exit(0);
});

process.on("uncaughtException", (error: Error) => {
    logger.error("Uncaught exception", { err: loggableError(error) });
    process.exit(1);
});

process.on("unhandledRejection", (reason: unknown, promise: Promise<unknown>) => {
    logger.error("Unhandled promise rejection", {
        promise: String(promise),
        reason: loggableError(reason),
    });
    process.exit(1);
});


void startConsumerWithRetry();

export default consumer;

