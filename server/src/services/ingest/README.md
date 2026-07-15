# Ingest Service


`ingest` is the entry point for the actual monitoring data - the `POST /api/hit` endpoint that client services call. It validates the incoming API key and its `canIngest` permission, applies a per-route rate limiter, validates the hit payload (service name, endpoint, method, status code, latency) with Zod, and then hands the validated event off to the shared event producer (circuit breaker + retry strategy + RabbitMQ confirm-channel publish) rather than writing to a database itself. This service's job ends the moment the event is durably queued.


## API reference


All endpoints are prefixed with `/api`. Authenticated routes expect a JWT, set via an HTTP-only cookie on login.


[INGEST-POSTMAN-API-DOCUMENTATION](https://documenter.getpostman.com/view/39489029/2sBXwyHnjR#2eebccee-b5b5-463e-9be0-c0b993656c70)


| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/api/hit` | API key (`x-api-key` header) | Ingest one API hit event |



## Dataflow Diagram of Ingest Service


![post-hit-dataflow-diagram](../../../public/dataflow-diagrams/post-hit-dataflow-diagram.svg)
