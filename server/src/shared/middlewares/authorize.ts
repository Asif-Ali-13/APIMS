import type { Request, Response, NextFunction } from "express";
import type { UserRole } from "../models/User.ts";
import AppError from "../utils/appError.ts";

/**
 * Requires an authenticated request whose `req.user.role` is one of `allowedRoles`.
 */
export default function authorize(allowedRoles: UserRole[]) {
    return (req: Request, _res: Response, next: NextFunction): void => {
        const role = req.user?.role;
        if (!role || !allowedRoles.includes(role)) {
            // 403: The client does not have access rights to the content.
            next(new AppError("Forbidden", 403));
            return;
        }
        next();
    };
}
