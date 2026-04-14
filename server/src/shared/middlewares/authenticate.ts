import jwt from "jsonwebtoken";
import type { Request, Response, NextFunction } from "express";
import AppError from "../utils/appError.ts";
import config from "../config/index.ts";
import { UserRole } from "../models/User.ts";


/**
 * Extracts JWT token from request.
 *
 * Supports:
 * - Authorization header: Bearer <token>
 * - Cookie: authToken
 *
 * @param req - Express Request object
 * @returns JWT token string or null if not found
 */
function readBearerOrCookie(req: Request): string | null {
    const auth = req.headers.authorization;
    if (typeof auth === "string" && auth.startsWith("Bearer ")) {
        return auth.slice(7).trim() || null;
    }
    const cookieToken = req.cookies?.authToken;
    return typeof cookieToken === "string" ? cookieToken : null;
}


/**
 * Type guard to validate if a value is a valid UserRole.
 *
 * @param value - Unknown value to validate
 * @returns True if value is a valid UserRole
 */
function isUserRole(value: unknown): value is UserRole {
    return (
        typeof value === "string" && 
        (Object.values(UserRole) as string[]).includes(value)
    );
}


/**
 * Authentication middleware.
 *
 * Responsibilities:
 * - Extracts JWT from header or cookies
 * - Verifies token using secret
 * - Validates payload structure
 * - Attaches authenticated user to `req.user`
 *
 *
 * @param req - Express Request object (augmented with `user`)
 * @param _res - Express Response object (unused)
 * @param next - Express NextFunction
 *
 * @returns void
 *
 * @throws {AppError} 401 if token is missing, invalid, or expired
 */
export default function authenticate(
    req: Request,
    _res: Response,
    next: NextFunction
): void {
    try {
        const token = readBearerOrCookie(req);
        if (!token) {
            next(new AppError("Not authenticated", 401));
            return;
        }

        const decoded = jwt.verify(token, config.jwt.secret);
        if (typeof decoded !== "object" || decoded === null) {
            next(new AppError("Invalid token", 401));
            return;
        }

        const d = decoded as Record<string, unknown>;
        const userId = d.userId;
        if (typeof userId !== "string") {
            next(new AppError("Invalid token", 401));
            return;
        }

        const user: NonNullable<Request["user"]> = { userId };
        if (typeof d.username === "string") user.username = d.username;
        if (typeof d.email === "string") user.email = d.email;
        if (isUserRole(d.role)) user.role = d.role;
        if (typeof d.clientId === "string") user.clientId = d.clientId;
        
        req.user = user;
        next();
    } 
    catch (err) {
        if (err instanceof jwt.JsonWebTokenError || err instanceof jwt.TokenExpiredError) {
            next(new AppError(
                err.message === "jwt expired" ? "Token expired" : "Invalid token", 401
            ));
            return;
        }
        
        // Forward unknown errors to global error handler
        next(err);
    }
}
