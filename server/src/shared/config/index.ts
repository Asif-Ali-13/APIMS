import dotenv from "dotenv";

dotenv.config();

const config = {
    // server
    node_env: process.env.NODE_ENV || 'development',
    port: parseInt(process.env.PORT || "5000", 10),

    // mongoDB
    mongo: {
        uri: process.env.MONGO_URI || "mongodb://localhost:27017/api_monitoring",
        dbName: process.env.MONGO_DB_NAME || "api_monitoring"
    },

    // postgrsql
    postgres: {
        host: process.env.PG_HOST || "localhost",
        port: parseInt(process.env.PG_PORT || "5432", 10),
        database: process.env.PG_DATABASE || "api_monitoring",
        user: process.env.PG_USER || "postgres",
        password: process.env.PG_PASSWORD || "postgres"
    },

    // rabbitMQ
    rabbitmq: {
        url: process.env.RABBITMQ_URL || "amqp://localhost:5672",
        queue: process.env.RABBITMQ_QUEUE || "api_hits",
        publisherConfirms: process.env.RABBITMQ_PUBLISHER_CONFIRMS === "true" || false, // MSGS lost
        retryAttempts: parseInt(process.env.RABBITMQ_RETRY_ATTEMPTS || "3", 10),
        retryDelay: parseInt(process.env.RABBITMQ_RETRY_DELAY || "1000", 10),
    },

    // jsonwebtoken
    jwt: {
        // fall-back for secret is random gibberish
        secret: process.env.JWT_SECRET || "0xe80f426d51d0wer7df77b25ca717bdfg1ded8118e2a837cbfa86813ced7518983",
        expiresIn: process.env.JWT_EXPIRES_IN || "24h"
    },

    // rateLimit
    rateLimit: {
        windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || "900000", 10),   // 15 mins
        maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || "1000", 10)    // 1000 reqs per 15 mins per IP
    },

    cookie: {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        expiresIn: 24 * 60 * 60 * 1000
    },
    
};

export default config;