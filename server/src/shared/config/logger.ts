import winston from "winston";
import config from "./index.ts";


/**
 * # Winston Logger Configuration
 * 
 * This module sets up a centralized logging system using Winston for the
 * API Monitoring service. It supports structured logging, error tracking,
 * and environment-based configurations.
 *
 * ## Features:
 * - Log levels:
 *   - 'debug' in development
 *   - 'info' in production
 *
 * - Log formatting:
 *   - Timestamped logs (YYYY-MM-DD HH:MM:SS)
 *   - JSON structured logs for better parsing and monitoring
 *   - Error stack traces included
 *   - Supports string interpolation (splat)
 *
 * - Default metadata:
 *   - Adds `service: 'api-monitoring'` to all logs
 *
 * - Log storage:
 *   - logs/error.log -> stores only error-level logs
 *   - logs/combined.log -> stores all logs
 *
 * - Console logging (non-production only):
 *   - Colorized output for better readability
 *   - Simple format for development debugging
 *
 * ## Usage:
 * Import the logger and use it across the application:
 * 
 *   - logger.info("Server started");
 *   - logger.error("Something went wrong", error);
 *   - logger.debug("Debug info");
 *
 */
const logger = winston.createLogger({
  level: config.node_env === "production" ? 'info': 'debug',
  
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:MM:SS' }),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    winston.format.json()
  ),

  defaultMeta: { service: 'api-monitoring' },
  transports: [
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' }),
  ],

});

if(config.node_env !== "production") {
    logger.add(new winston.transports.Console({
        format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple()
        )
    }))
}

export default logger;