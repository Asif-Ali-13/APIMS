/**
 * Demo Blog API — sample Express service that reports every response to the
 * API Hit Monitoring platform via {@link createMonitoringMiddleware}.
 */
import "dotenv/config";
import cors from "cors";

import express, {
    type NextFunction,
    type Request,
    type Response,
} from "express";

import createMonitoringMiddleware from "./monitoring.ts";
import type { Comment, Post } from "./types.ts";


const app = express();
const PORT = Number(process.env.PORT) || 3002;


app.use(cors());
app.use(express.json());

app.use(
    createMonitoringMiddleware({
        serviceName: "blog-api",
        enableLogging: true,
    })
);


const posts: Post[] = [
    {
        id: 1,
        title: "Why TypeScript Fits API Services",
        content:
            "Strong typing catches contract drift between services early, especially when multiple teams share HTTP boundaries.",
        author: "Maya Chen",
        tags: ["typescript", "apis", "backend"],
        publishedAt: "2026-03-12T09:00:00Z",
        views: 1842,
        likes: 112,
    },
    {
        id: 2,
        title: "Designing Observable Microservices",
        content:
            "Pair structured logs with per-route latency and status metrics so on-call engineers can narrow incidents quickly.",
        author: "Jordan Lee",
        tags: ["observability", "monitoring", "microservices"],
        publishedAt: "2026-04-02T14:20:00Z",
        views: 967,
        likes: 74,
    },
    {
        id: 3,
        title: "Caching Strategies for Read-Heavy APIs",
        content:
            "Use TTL-based caches for hot list endpoints, but keep comment threads fresh with shorter expirations or cache busting.",
        author: "Samira Patel",
        tags: ["caching", "performance", "redis"],
        publishedAt: "2026-04-18T11:45:00Z",
        views: 2510,
        likes: 198,
    },
    {
        id: 4,
        title: "Graceful Degradation Under Load",
        content:
            "Return partial results or cached snapshots before timing out entirely; your clients and monitors both benefit.",
        author: "Alex Rivera",
        tags: ["reliability", "resilience", "sla"],
        publishedAt: "2026-05-01T16:30:00Z",
        views: 640,
        likes: 41,
    },
];


const comments: Comment[] = [
    {
        id: 201,
        postId: 1,
        author: "dev_reader",
        content: "Clear explanation — adopting TS on our gateway next sprint.",
        timestamp: "2026-03-13T10:15:00Z",
    },
    {
        id: 202,
        postId: 1,
        author: "api_fan",
        content: "Would love a follow-up on Zod + OpenAPI generation.",
        timestamp: "2026-03-14T08:40:00Z",
    },
    {
        id: 203,
        postId: 2,
        author: "sre_night",
        content: "We ship the same pattern with a sidecar ingest agent.",
        timestamp: "2026-04-03T19:05:00Z",
    },
    {
        id: 204,
        postId: 2,
        author: "platform_ops",
        content: "Dashboard link in the README would be handy.",
        timestamp: "2026-04-04T07:22:00Z",
    },
    {
        id: 205,
        postId: 3,
        author: "cache_curious",
        content: "What TTL do you use for paginated post lists?",
        timestamp: "2026-04-19T12:00:00Z",
    },
    {
        id: 206,
        postId: 3,
        author: "Maya Chen",
        content: "Usually 30–60s for lists; comments stay uncached in this demo.",
        timestamp: "2026-04-19T13:18:00Z",
    },
    {
        id: 207,
        postId: 4,
        author: "oncall_bot",
        content: "Simulated 503s on comments help test error-rate alerts nicely.",
        timestamp: "2026-05-02T09:00:00Z",
    },
];


function parseLimit(value: unknown, fallback = 10): number {
    const parsed = typeof value === "string" ? parseInt(value, 10) : fallback;
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}


/**
 * GET /api/posts — list posts with optional `author`, `tag`, and `limit` filters.
 * Response time scales slightly with result count to simulate heavier queries.
 */
app.get("/api/posts", (req: Request, res: Response): void => {
    try {
        const { author, tag, limit: limitQuery } = req.query;
        let filteredPosts = [...posts];

        if (typeof author === "string" && author) {
            const needle = author.toLowerCase();
            filteredPosts = filteredPosts.filter((post) =>
                post.author.toLowerCase().includes(needle)
            );
        }

        if (typeof tag === "string" && tag) {
            const needle = tag.toLowerCase();
            filteredPosts = filteredPosts.filter((post) =>
                post.tags.some((t) => t.toLowerCase().includes(needle))
            );
        }

        const limit = parseLimit(limitQuery);
        filteredPosts = filteredPosts.slice(0, limit);

        const processingTime = filteredPosts.length * 20 + Math.random() * 100;

        setTimeout(() => {
            res.json({
                success: true,
                data: {
                    posts: filteredPosts,
                    total: filteredPosts.length,
                    filters: { author, tag, limit },
                },
            });
        }, processingTime);
    } 
    catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Unknown error";
        res.status(500).json({
            success: false,
            message: "Error fetching posts",
            error: message,
        });
    }
});


/**
 * GET /api/posts/:postId/comments - comments for one post.
 * ~3% of requests return 503 to exercise error metrics in monitoring.
 */
app.get("/api/posts/:postId/comments", (req: Request, res: Response): void => {
    try {
        const postIdNum = parseInt(String(req.params.postId), 10);

        if (Math.random() < 0.03) {
            res.status(503).json({
                success: false,
                message: "Service temporarily unavailable",
                error: "Comment store maintenance in progress",
            });
            return;
        }

        const post = posts.find((p) => p.id === postIdNum);
        if (!post) {
            res.status(404).json({
                success: false,
                message: "Post not found",
            });
            return;
        }

        const postComments = comments.filter((c) => c.postId === postIdNum);
        const totalTime = 50 + postComments.length * 25 + Math.random() * 100;

        setTimeout(() => {
            res.json({
                success: true,
                data: {
                    postId: postIdNum,
                    postTitle: post.title,
                    comments: postComments,
                    totalComments: postComments.length,
                },
            });
        }, totalTime);
    } 
    catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Unknown error";
        res.status(500).json({
            success: false,
            message: "Error fetching comments",
            error: message,
        });
    }
});


/**
 * GET /health - health check endpoint.
 */
app.get("/health", (_req: Request, res: Response): void => {
    res.json({
        service: "blog-api",
        status: "healthy",
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
    });
});


/**
 * GET / - root endpoint.
 */
app.get("/", (_req: Request, res: Response): void => {
    res.json({
        service: "Demo Blog API",
        version: "1.0.0",
        endpoints: {
            posts: "/api/posts",
            comments: "/api/posts/:postId/comments",
            health: "/health",
        },
        monitoring: process.env.MONITORING_API_KEY ? "enabled" : "disabled",
    });
});


/**
 * 404 handler.
 */
app.use((_req: Request, res: Response): void => {
    res.status(404).json({
        success: false,
        message: "Endpoint not found",
        availableEndpoints: [
            "/api/posts",
            "/api/posts/:postId/comments",
            "/health",
        ],
    });
});


/**
 * Error handler.
 */
app.use(
    (
        err: Error,
        _req: Request,
        res: Response,
        _next: NextFunction
    ): void => {
        console.error(err.stack);
        res.status(500).json({
            success: false,
            message: "Something went wrong!",
            error:
                process.env.NODE_ENV === "development"
                    ? err.message
                    : "Internal server error",
        });
    }
);


app.listen(PORT, () => {
    
    console.log(`Blog API running on http://localhost:${PORT}`);
    console.log(
        `Monitoring: ${process.env.MONITORING_API_KEY ? "ENABLED" : "DISABLED"}`
    );

    console.log(`  GET  http://localhost:${PORT}/api/posts`);
    console.log(`  GET  http://localhost:${PORT}/api/posts/1/comments`);
});
