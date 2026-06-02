import express from "express";
import type { Application, Request, Response, NextFunction } from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import helmet from "helmet";

import config from "./shared/config/index.ts";
import logger from "./shared/config/logger.ts";
import mongodb from "./shared/config/mongodb.ts";
import postgres from "./shared/config/postgres.ts";
import rabbitmq from "./shared/config/rabbitmq.ts";

import errorHandler from "./shared/middlewares/errorHandler.ts";
import ResponseFormatter from "./shared/utils/responseFormatter.ts";
/**
 * importing routers 
 */
import authRouter from "./services/auth/routes/authRouter.ts";
import clientRouter from "./services/client/routes/clientRouter.ts";
import injestRouter from "./services/ingest/routes/injestRoutes.ts";
import analyticsRouter from "./services/analytics/routes/analyticsRoutes.ts";


/**
 * Create and configure the Express application instance.
 */
const app: Application = express();

/**
 * Register global middlewares.
 *
 * - helmet: Secures HTTP headers
 * - cors: Enables Cross-Origin Resource Sharing
 * - express.json: Parses JSON request bodies
 * - express.urlencoded: Parses URL-encoded payloads
 */
app.use(helmet());
app.use(cors());
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));


/**
 * Request logging middleware.
 *
 * Logs incoming HTTP requests including:
 * - HTTP method
 * - Request path
 * - Client IP
 * - User-Agent header
 *
 * @param req - Express request object
 * @param res - Express response object
 * @param next - Next middleware function
 */
app.use((req: Request, _, next: NextFunction): void => {
    logger.info(`${req.method} ${req.path}`, {
        ip: req.ip,
        userAgent: req.headers['user-agent']
    });
    next()
})

/**
 * Health check endpoint.
 *
 * Used to verify service status and uptime.
 *
 * @route GET /health
 * @returns {object} Service health information
 */
app.get("/health", (_, res: Response): void => {
    res.status(200).json(
        ResponseFormatter.success(
            {
                status: 'healthy',
                timestamp: new Date().toISOString(),
                uptime: process.uptime(),
            },
            'Service is healthy'
        )
    );
});

/**
 * Root endpoint.
 *
 * Provides metadata about the API including:
 * - Service name
 * - Version
 * - Available endpoints
 *
 * @route GET /
 */
app.get("/", (_, res: Response): void => {
    res.status(200).json(
        ResponseFormatter.success(
            {
                service: 'API Hit Monitoring System',
                version: '1.0.0',
                endpoints: {
                    health: '/health',
                    auth: '/api/auth',
                    ingest: '/api/hit',
                    analytics: '/api/analytics',
                },
            },
            'API Hit Monitoring Service'
        )
    )
});


/**
 * all routes that uses service routers
 */
app.use("/api/auth", authRouter);
app.use("/api/hit", injestRouter);
app.use("/api/analytics", analyticsRouter);
app.use("/api", clientRouter);


/**
 * 404 Not Found handler.
 *
 * Triggered when no route matches the incoming request.
 *
 * @param req - Express request object
 * @param res - Express response object
 */
app.use((_, res: Response): void => {
    res.status(404).json(
        ResponseFormatter.error("Endpoint not found", 404)
    );
});

/**
 * Global error handling middleware.
 *
 * Handles all application-level errors in a centralized way.
 */
app.use(errorHandler)

/**
 * Initialize all external service connections.
 *
 * This includes:
 * - MongoDB connection
 * - PostgreSQL connection
 * - RabbitMQ connection
 *
 * @throws Will throw an error if any connection fails
 */
async function initializeConnection(): Promise<void> {
    try {
        logger.info("Initializing database connections...");

        // Connect to MongoDB;
        await mongodb.connect();

        // Connect to PG;
        await postgres.testConnection();

        // Connect to RabbitMQ;
        await rabbitmq.connect();

        logger.info("All connections established successfully");
    } 
    catch (error) {
        logger.error("Failed to initialize connections:", error);
        throw error;
    }
}

/**
 * Starts the HTTP server after initializing dependencies.
 *
 * Also sets up:
 * - Graceful shutdown handlers
 * - Uncaught exception handling
 * - Unhandled promise rejection handling
 *
 * @returns {Promise<void>}
 */
async function startServer(): Promise<void>  {
    try {
        await initializeConnection();

        const server = app.listen(config.port, () => {
            logger.info(`Server started on port ${config.port}`);
            logger.info(`Environment: ${config.node_env}`);
            logger.info(`API available at: http://localhost:${config.port}`);
        });

        /**
         * Gracefully shuts down the server and closes all connections.
         *
         * @param signal - Process signal triggering shutdown
         */
        const gracefulShutdown = async (signal: NodeJS.Signals | string): Promise<void> => {
            logger.info(`${signal} received, shutting down gracefully...`);

            server.close(async () => {
                logger.info("HTTP server closed");

                try {
                    await mongodb.disconnect();
                    await postgres.close();
                    await rabbitmq.close();
                    logger.info('All connections closed, exiting process');
                    process.exit(0);
                } 
                catch (error) {
                    logger.error('Error during shutdown:', error);
                    process.exit(1);
                }
            })

            // Force shutdown if graceful shutdown takes too long
            setTimeout(() => {
                logger.error("Forced shutdown")
                process.exit(1);
            }, 10000);

        }

        /**
         * Handle system termination signals.
         */
        process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
        process.on("SIGINT", () => gracefulShutdown("SIGINT"));

        /**
         * Handle uncaught exceptions.
         */
        process.on('uncaughtException', (error) => {
            logger.error('Uncaught Exception:', error);
            gracefulShutdown('uncaughtException');
        });

        /**
         * Handle unhandled promise rejections.
         */
        process.on('unhandledRejection', (reason, promise) => {
            logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
            gracefulShutdown('unhandledRejection');
        });

    } 
    catch (error) {
        logger.error('Failed to start server:', error);
        process.exit(1);
    }
}

/**
 * Entry point of the application.
 *
 * Initializes dependencies and starts the server.
 */
startServer()
