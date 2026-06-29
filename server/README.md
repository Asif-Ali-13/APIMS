# APIMS Server

The monitoring platform: an Express API that ingests API-hit events from client services, an async pipeline that persists and aggregates them, and a set of authenticated endpoints to read the resulting analytics back.


![High-Level-Architecture](/server/public/high-level-architecture/server-high-level-architecture-diagram.svg)


## Quick start


### 1. Running locally

Requires Node 18+, and local or reachable instances of MongoDB, PostgreSQL, and RabbitMQ (the quickest way to get all three is `docker compose up postgres mongo rabbitmq` from this folder, then run the app processes on the host).

```bash
cd server
npm install
cp .env.example .env        # then edit values as needed
# OR npm run init:env       # copies .env.example → .env
npm run dev                 # starts the API server with hot reload
```

### 2. Running with Docker

`docker-compose.yml` brings up the full stack: PostgreSQL, MongoDB, RabbitMQ (with its management UI), pgAdmin, the API server, and the consumer, wired together on a shared network with health-check-gated startup ordering.

```bash
cd server
docker compose up --build
```

Once healthy, the API is reachable at `http://localhost:5001` (mapped from the container's internal port 5000), RabbitMQ's management UI at `http://localhost:15672`, and pgAdmin at `http://localhost:8080`. Set `JWT_SECRET` in your shell environment before running `docker compose up`, since the compose file passes it through rather than hardcoding it.


### 3. Run the Processor

In a second terminal, start the consumer (it will not run automatically alongside the API server):

```bash
npm run processor
```



## Project structure

```
server/src/
├── server.ts                      # API server entry point
├── services/
│   ├── auth/                      # registration, login, JWT, RBAC
│   ├── client/                    # tenant onboarding, API key issuance
│   ├── ingest/                    # POST /api/hit handling + validation
│   ├── analytics/                 # read-side aggregation endpoints
│   └── processor/                 # consumer entry point + persistence
│       ├── consumer.ts            # standalone consumer process
│       ├── service/               # processEvent: Mongo write + Postgres upsert
│       └── repository/            # ApiHitRepository (Mongo), MetricsRepository (Postgres)
├── scripts/init-postgres.sql      # Metrics schema 
├── shared/
│   ├── config/                    # env loading, Mongo/Postgres/RabbitMQ connection setup
│   ├── middlewares                # authenticate, authorize, validateApiKey, errorHandler
│   ├── events/
│   │   └── producer/              # CircuitBreaker, RetryStrategy, ConfirmChannelManager, EventProducer
│   ├── models/                    # Mongoose schemas
│   ├── utils/                     # AppError, ResponseFormatter, SecurityUtils
│   └── validation/                # Zod request parser
├── docker-compose.yml
├── Dockerfile
├── Dockerfile.consumer
└── .env.example
```

Each service module (`auth`, `client`, `ingest`, `analytics`) follows the same internal layering: `routes` → `controller` → `service` → `repository`, wired together through a small `Dependencies` container per module.




## Environment variables

Copy `.env.example` to `.env` and adjust as needed. Defaults shown are what the code falls back to if a variable is unset.

| Variable | Default | Notes |
|---|---|---|
| `NODE_ENV` | `development` | |
| `PORT` | `5000` | |
| `MONGO_URI` | `mongodb://localhost:27017/api_monitoring` | |
| `MONGO_DB_NAME` | `api_monitoring` | |
| `PG_HOST` / `PG_PORT` / `PG_DATABASE` / `PG_USER` / `PG_PASSWORD` | `localhost` / `5432` / `api_monitoring` / `postgres` / — | Must match `docker-compose.yml` when running via Docker |
| `RABBITMQ_URL` | `amqp://localhost:5672`, `management UI 15672` | Must include the vhost when running via Docker (see `.env.example`) |
| `RABBITMQ_QUEUE` | `api_hits` | |
| `RABBITMQ_RETRY_ATTEMPTS` | `3` | Used by both the producer's publish retries and the consumer's message retries |
| `RABBITMQ_RETRY_DELAY` | `1000` (ms) | Base delay before exponential backoff |
| `JWT_SECRET` | — | **Must** be overridden in any non-local environment |
| `JWT_EXPIRES_IN` | `24h` | |
| `RATE_LIMIT_WINDOW_MS` | `900000` (15 min) | Applies to the ingest endpoint |
| `RATE_LIMIT_MAX_REQUESTS` | `1000` | Per IP, per window |




