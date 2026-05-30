/**
 * Express handlers for analytics APIs: permission checks, client scoping,
 * query validation, and delegation to {@link AnalyticsService}.
 *
 * @module services/analytics/controller/analyticsController
 */
import AppError from "../../../shared/utils/appError.ts";
import ResponseFormatter from "../../../shared/utils/responseFormatter.ts";

import type { NextFunction, Request, Response } from "express";
import type { AuthService } from "../../auth/service/authService.ts";
import type { IClientRepository } from "../../client/repositories/IClientRepository.ts";
import type { AnalyticsService } from "../service/analyticsService.ts";
import type { AnalyticsDashboardDto } from "../dto/analyticsResponseDto.ts";


/** Parsed `startTime` / `endTime` query values (epoch ms or null when omitted). */
export interface ValidatedTimeRange {
    startTime: number | null;
    endTime: number | null;
}

/** Constructor dependencies for {@link AnalyticsController}. */
export interface AnalyticsControllerDeps {
    /** Metrics aggregation service. */
    analyticsService: AnalyticsService;

    /** Used for super-admin and profile permission checks. */
    authService: AuthService;

    /** Validates tenant existence when resolving `clientId`. */
    clientRepository: IClientRepository;
}


/**
 * Handles authenticated analytics routes with role-based client scoping.
 */
export class AnalyticsController {
    private readonly analyticsService: AnalyticsService;
    private readonly authService: AuthService;
    private readonly clientRepository: IClientRepository;


    /**
     * @param deps - Must include `analyticsService`, `authService`, and `clientRepository`.
     * @throws Error if any dependency is missing.
     */
    constructor(deps: AnalyticsControllerDeps) {
        if (!deps?.analyticsService) throw new Error("analyticsService is required");
        if (!deps?.authService) throw new Error("authService is required");
        if (!deps?.clientRepository) throw new Error("clientRepository is required");

        this.analyticsService = deps.analyticsService;
        this.authService = deps.authService;
        this.clientRepository = deps.clientRepository;
    }


    /**
     * `GET /stats` — overall hit statistics for the resolved client (or global for super admin).
     */
    getStats = async (
        req: Request, res: Response, next: NextFunction
    ): Promise<void> => {
        
        try {
            const { startTime, endTime } = req.query;

            const isSuperAdmin = await this.ensureCanViewAnalytics(req);
            const finalClientId = await this.resolveFinalClientId(req, isSuperAdmin);
            const timeRange = this.validateTimeRange(startTime, endTime);

            const stats = 
                await this.analyticsService.getOverallStats(finalClientId, timeRange);

            res.status(200).json(
                ResponseFormatter.success(stats, "Statistics retrieved successfully", 200)
            );
        } 
        catch (error) { next(error); }
    };


    /**
     * Parses optional `startTime` / `endTime` query values as epoch milliseconds or ISO strings.
     *
     * @throws AppError 400 when a provided value is invalid or start exceeds end.
     */
    private validateTimeRange(
        startTime: unknown,
        endTime: unknown
    ): ValidatedTimeRange {
        
        const parseValue = (value: unknown): number | null => {
            if (value === undefined || value === null || value === "") return null;
            if (/^\d+$/.test(String(value))) return Number(value);

            const parsed = Date.parse(String(value));
            return Number.isNaN(parsed) ? NaN : parsed;
        };

        const start = parseValue(startTime);
        const end = parseValue(endTime);

        if ((startTime && Number.isNaN(start)) || (endTime && Number.isNaN(end))) {
            throw new AppError("Invalid time format", 400);
        }

        if (start !== null && end !== null && start > end) {
            throw new AppError("Invalid time range: start > end", 400);
        }

        return { startTime: start, endTime: end };
    }


    /**
     * Ensures the caller is authenticated and allowed to view analytics.
     *
     * @returns `true` when the caller is a super admin (may omit `clientId`).
     * @throws AppError 401 / 403 when auth or permissions are insufficient.
     */
    private async ensureCanViewAnalytics(req: Request): Promise<boolean> {
        if (!req.user?.userId) {
            throw new AppError("Authentication required", 401);
        }

        const isSuperAdmin = 
            await this.authService.checkSuperAdminPermissions(req.user.userId);
        if (isSuperAdmin) return true;

        const profile = await this.authService.getProfile(req.user.userId);

        if (!profile.permissions?.canViewAnalytics) {
            throw new AppError("Insufficient permissions to view analytics", 403);
        }

        return false;
    }


    /**
     * Resolves the effective Mongo client id for the request.
     *
     * Super admins may pass `?clientId=` or omit it for global stats.
     * Other users are scoped to their own `clientId`.
     *
     * @throws AppError 400 / 403 / 404 for invalid ids, missing association, or unknown client.
     */
    private async resolveFinalClientId(
        req: Request,
        isSuperAdmin: boolean
    ): Promise<string | null> {

        const queryClientId = req.query.clientId;
        const userClientId = req.user?.clientId;

        if (isSuperAdmin) {
            if (typeof queryClientId === "string" && queryClientId) {
                if (!this.isValidObjectId(queryClientId)) {
                    throw new AppError("Invalid clientId format", 400);
                }

                const client = await this.clientRepository.findById(queryClientId);
                if (!client) throw new AppError("Client not found", 404);

                return queryClientId;
            }

            return null;
        }

        if (!userClientId) {
            throw new AppError("Access denied - no client association", 403);
        }

        if (!this.isValidObjectId(userClientId)) {
            throw new AppError("Invalid client association", 400);
        }

        const client = await this.clientRepository.findById(userClientId);
        if (!client) throw new AppError("Client not found", 404);

        return userClientId;
    }

    /** Validates a 24-character hex MongoDB ObjectId string. */
    private isValidObjectId(id: string): boolean {
        return /^[0-9a-fA-F]{24}$/.test(id);
    }

    
    /**
     * `GET /dashboard` — stats, top endpoints, and recent time-series in one response.
     *
     * Partial failures are tolerated: failed sub-queries appear as `null` in the payload.
     */
    getDashboard = async (
        req: Request, res: Response, next: NextFunction
    ): Promise<void> => {
        
        try {
            const { startTime, endTime } = req.query;

            const isSuperAdmin = await this.ensureCanViewAnalytics(req);
            const finalClientId = await this.resolveFinalClientId(req, isSuperAdmin);
            const timeRange = this.validateTimeRange(startTime, endTime);

            const result = await Promise.allSettled([
                this.analyticsService.getOverallStats(finalClientId, timeRange),

                this.analyticsService.getTopEndpoints(finalClientId, {
                    limit: 5,
                    startTime: timeRange.startTime,
                }),

                this.analyticsService.getTimeSeries(finalClientId, {
                    ...timeRange,
                    limit: 24,
                }),
            ]);

            const stats = result[0].status === "fulfilled" ? result[0].value : null;
            const topEndpoints = result[1].status === "fulfilled" ? result[1].value : null;
            const recentActivity = result[2].status === "fulfilled" ? result[2].value : null;

            const dashboard: AnalyticsDashboardDto = {
                stats,
                topEndpoints,
                recentActivity,
            };

            res.status(200).json(
                ResponseFormatter.success(dashboard, "Dashboard data retrieved successfully", 200)
            );
        } 
        catch (error) { next(error); }
    };
}
