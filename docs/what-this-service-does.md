# What this service does

A client service (anything making HTTP requests it wants tracked) reports each request it serves to `POST /api/hit`, authenticated with a per-client API key. APIMS validates, queues, and persists that event, then exposes aggregated analytics - total hits, error rate, average/min/max latency, top endpoints by traffic - over authenticated REST endpoints, scoped per tenant.

It is not an APM agent and does not instrument the client's code automatically; the client service is responsible for calling the ingest endpoint (typically via a small middleware - see the [demo blog API](../demo/blog_api/src/monitoring.ts)  for a working example).