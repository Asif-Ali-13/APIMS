
import type { Request, Response, NextFunction } from "express";
import logger from "../config/logger";

/**
 * Express middleware for logging HTTP requests.
 *
 * Logs request details after the response is sent, including:
 * - HTTP method (GET, POST, etc.)
 * - Request URL/path
 * - Client IP address
 * - Response status code
 * - Total request duration (in ms)
 *
 * This middleware is useful for monitoring, debugging,
 * and performance tracking in production systems.
 *
 * @param req - Express Request object
 * @param res - Express Response object
 * @param next - Express NextFunction to pass control to next middleware
 *
 * @returns void
 */
const requestLogger = (
    req: Request,
    res: Response,
    next: NextFunction
): void => {
    const start = Date.now();

    res.on("finish", () => {
        const duration = Date.now() - start;

        const method = req.method;
        const path = req.originalUrl || req.url;
        const ip = req.ip ?? req.socket.remoteAddress ?? "unknown";
        const status = res.statusCode;

        logger.info(
            "HTTP %s %s %s %dms",
            method,
            path,
            ip,
            duration,
            {
                method, path, status, duration,
            }
        );
    });

    next();
};

export default requestLogger;
