import ResponseFormatter from "../../../shared/utils/responseFormatter.ts";
import AppError from "../../../shared/utils/appError.ts";
import config from "../../../shared/config/index.ts";

import type { Request, Response, NextFunction } from "express";
import type { AuthService } from "../service/authService.ts";

import { parseBody } from "../../../shared/validation/requestParser.ts";
import {
    onboardSuperAdminBodySchema,
    registerBodySchema,
    loginBodySchema,
} from "../dto/authRequestDto.ts";

/** Constructor dependencies for {@link AuthController}. */
export interface AuthControllerDeps {
    /** Domain service invoked after request parsing. */
    authService: AuthService;
}

/**
 * Express handlers for auth: parse and validate bodies with Zod, delegate to
 * {@link AuthService}, then send JSON via {@link ResponseFormatter} and cookie side effects.
 */
export class AuthController {
    private readonly authService: AuthService;

    /**
     * @param deps - Must include `authService`.
     * @throws Error if `authService` is missing.
     */
    constructor(deps: AuthControllerDeps) {
        if (!deps?.authService) {
            throw new Error("authService is required");
        }
        this.authService = deps.authService;
    }

    
    /**
     * `POST /onboard-super-admin` — first-run super admin; sets `authToken` on success.
     */
    onboardSuperAdmin = async (
        req: Request,
        res: Response,
        next: NextFunction
    ): Promise<void> => {
        try {
            const body = parseBody(onboardSuperAdminBodySchema, req.body);
            const { token, user } = await this.authService.onboardSuperAdmin(body);

            res.cookie("authToken", token, {
                httpOnly: config.cookie.httpOnly,
                secure: config.cookie.secure,
                maxAge: config.cookie.expiresIn,
            });

            res.status(201).json
                (ResponseFormatter.success(user, "Super admin created successfully", 201));
        } 
        catch (error) { next(error); }
    };


    /**
     * `POST /register` — create user; sets `authToken` on success (caller must enforce role guard).
     */
    register = async (
        req: Request,
        res: Response,
        next: NextFunction
    ): Promise<void> => {
        try {
            const body = parseBody(registerBodySchema, req.body);
            const { token, user } = await this.authService.register(body);

            res.cookie("authToken", token, {
                httpOnly: config.cookie.httpOnly,
                secure: config.cookie.secure,
                maxAge: config.cookie.expiresIn,
            });

            res.status(201).json
                (ResponseFormatter.success(user, "User created successfully", 201));
        } 
        catch (error) { next(error); }
    };


    /** `POST /login` — credentials → JWT in `authToken` cookie and user payload in body. */
    login = async (
        req: Request,
        res: Response,
        next: NextFunction
    ): Promise<void> => {
        try {
            const body = parseBody(loginBodySchema, req.body);
            const { user, token } = await this.authService.login(body);

            res.cookie("authToken", token, {
                httpOnly: config.cookie.httpOnly,
                secure: config.cookie.secure,
                maxAge: config.cookie.expiresIn,
            });

            res.status(200).json
                (ResponseFormatter.success(user, "User LoggedIn successfully", 200));
        } 
        catch (error) { next(error); }
    };


    /**
     * `GET /profile` — loads `req.user.userId` from auth middleware and returns public profile.
     */
    getProfile = async (
        req: Request,
        res: Response,
        next: NextFunction
    ): Promise<void> => {
        try {
            const userId = req.user?.userId;
            if (!userId) {
                throw new AppError("Not authenticated", 401);
            }

            const result = await this.authService.getProfile(userId);
            res.status(200).json
                (ResponseFormatter.success(result, "Profile fetched successfully", 200));
        } 
        catch (error) { next(error); }
    };


    /** `GET /logout` — clears `authToken` cookie. */
    logout = async (
        _req: Request,
        res: Response,
        next: NextFunction
    ): Promise<void> => {
        try {
            res.clearCookie("authToken");
            res.status(200).json
                (ResponseFormatter.success({}, "Logout successful", 200));
        } 
        catch (error) { next(error); }
    };
}
