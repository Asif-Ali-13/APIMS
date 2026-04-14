import type { Request, Response, NextFunction } from "express";
import AppError from "../utils/appError.ts";
import logger from "../config/logger.ts";
import ResponseFormatter from "../utils/responseFormatter.ts";

/**
 * Shape of MongoDB duplicate key error.
 */
type MongoError = {
  code?: number;
  keyValue?: Record<string, any>;
};


/**
 * Global Express error handling middleware.
 *
 * Responsibilities:
 * - Handles operational errors (AppError)
 * - Normalizes unknown errors into safe responses
 * - Maps common library errors (MongoDB, JWT, Validation)
 * - Logs detailed error information for debugging
 * - Sends a consistent API error response format
 *
 * @param err - Error object (can be AppError or generic Error)
 * @param req - Express Request object
 * @param res - Express Response object
 * @param _next - Express NextFunction (unused, but required by Express)
 *
 * @returns void
 */
const errorHandler = (
  err: Error | AppError,
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
    /**
     * Default error values
     */
    let statusCode = res.statusCode || 500;
    let message = err.message || "Internal server error";
    let errors: string[] | null = null;

    /**
     * Handle known operational errors (custom AppError)
     */
    if (err instanceof AppError && err.isOperational) {
        statusCode = err.statusCode;
        message = err.message;
        errors = err.errors;
    }

    /**
     * Log detailed error information for debugging/monitoring
     */
    logger.error('Error occurred:', {
        message: err.message,
        statusCode,
        stack: err.stack,
        path: req.path,
        method: req.method,
    });

    if (err.name === "ValidationError") {
        statusCode = 400;
        message = "Validation Error";
        errors = Object.values((err as any).errors).map((e: any) => e.message);
    }
    else if (err.name === 'MongoServerError' && (err as MongoError).code === 11000) {
        statusCode = 409;
        const field = Object.keys((err as MongoError).keyValue || {})[0];
        message = `${field} already exists`;
    } 
    else if (err.name === 'JsonWebTokenError') {
        statusCode = 401;
        message = 'Invalid token';
    } 
    else if (err.name === 'TokenExpiredError') {
        statusCode = 401;
        message = 'Token expired';
    };
    
    /**
     * Send standardized error response
     */
    res.status(statusCode).json(ResponseFormatter.error(message, statusCode, errors))
}

export default errorHandler;

