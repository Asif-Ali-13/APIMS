/**
 * Express middleware that reports each completed HTTP response to the API Hit Monitoring
 * ingest endpoint (`POST /api/hit`). Copy this file into your own services and configure
 * `MONITORING_API_KEY` plus `MONITORING_ENDPOINT`.
 */
import axios, { isAxiosError } from "axios";
import type { NextFunction, Request, Response } from "express";


/** Payload shape expected by the monitoring server ingest API. */
export interface MonitoringHitPayload {
    serviceName: string;
    endpoint: string;
    method: string;
    statusCode: number;
    latencyMs: number;
    ip: string;
    userAgent: string;
}

/** Options passed to {@link createMonitoringMiddleware}. */
export interface MonitoringMiddlewareOptions {
    /** API key issued during client onboarding (falls back to `MONITORING_API_KEY`). */
    apiKey?: string;
    /** Ingest URL (defaults to `MONITORING_ENDPOINT` or `http://localhost:5000/api/hit`). */
    endpoint?: string;
    /** Logical service name stored in analytics (defaults to `SERVICE_NAME` or `my-service`). */
    serviceName?: string;
    /** Log outbound ingest attempts to the console. */
    enableLogging?: boolean;
    /** HTTP timeout for ingest requests in milliseconds. */
    timeout?: number;
    /** Set `false` to disable reporting without removing the middleware. */
    enabled?: boolean;
}

/** Options passed to {@link sendMonitoringData}. */
interface SendMonitoringOptions {
    apiKey: string;
    endpoint: string;
    enableLogging: boolean;
    timeout: number;
}


/**
 * Creates middleware that measures response latency and asynchronously POSTs a hit
 * record to the monitoring platform. When no API key is configured, the middleware
 * is a no-op so local development works without the monitoring stack.
 */
export function createMonitoringMiddleware(
    options: MonitoringMiddlewareOptions = {}
): (req: Request, res: Response, next: NextFunction) => void {
   
    const apiKey = options.apiKey ?? process.env.MONITORING_API_KEY;
    const endpoint =
        options.endpoint ??
        process.env.MONITORING_ENDPOINT ??
        "http://localhost:5001/api/hit";

    const serviceName =
        options.serviceName ?? process.env.SERVICE_NAME ?? "my-service";
    
    const enableLogging =
        options.enableLogging ?? process.env.NODE_ENV !== "production";
    
    const timeout = options.timeout ?? 3000;
    const enabled = options.enabled ?? process.env.MONITORING_ENABLED !== "false";

    if (!enabled || !apiKey) {
        if (enableLogging && !apiKey) {
            console.warn("Monitoring middleware: API key not configured (skipping ingest)");
        }
        return (_req: Request, _res: Response, next: NextFunction) => next();
    }

    const sendOptions: SendMonitoringOptions = {
        apiKey,
        endpoint,
        enableLogging,
        timeout,
    };

    return (req: Request, res: Response, next: NextFunction): void => {
        const startTime = Date.now();

        res.on("finish", () => {
            const latencyMs = Date.now() - startTime;

            const monitoringData: MonitoringHitPayload = {
                serviceName,
                endpoint: req.originalUrl || req.url,
                method: req.method,
                statusCode: res.statusCode,
                latencyMs,
                ip: req.ip || req.socket.remoteAddress || "unknown",
                userAgent: req.get("User-Agent") || "unknown",
            };

            setImmediate(() => {
                void sendMonitoringData(monitoringData, sendOptions);
            });
        });

        next();
    };
}


/** Default export for `app.use(monitoringMiddleware())` ergonomics. */
export default createMonitoringMiddleware;


/**
 * Sends monitoring data to the monitoring server.
 */
async function sendMonitoringData(
    data: MonitoringHitPayload,
    options: SendMonitoringOptions
): Promise<void> {
    try {
        if (options.enableLogging) {
            console.log("Sending monitoring data:", {
                endpoint: data.endpoint,
                method: data.method,
                statusCode: data.statusCode,
                latencyMs: data.latencyMs,
            });
        }

        await axios.post(options.endpoint, data, {
            headers: {
                "x-api-key": options.apiKey,
                "Content-Type": "application/json",
            },
            timeout: options.timeout,
        });

        if (options.enableLogging) {
            console.log("Monitoring data sent successfully");
        }
    } 
    catch (error: unknown) {
        if (!options.enableLogging) return;

        if (isAxiosError(error) && error.response) {
            const message =
                typeof error.response.data === "object" &&
                error.response.data !== null &&
                "message" in error.response.data
                    ? String((error.response.data as { message: unknown }).message)
                    : error.response.statusText;
            
            console.error(
                `Failed to send monitoring data to ${options.endpoint}:`,
                error.response.status,
                message || error.response.statusText
            );
            return;
        }

        console.error(
            "Failed to send monitoring data:",
            error instanceof Error ? error.message : String(error)
        );
    }
}
