# Processor Service

`Processor` is the consumer side of the pipeline, and it runs as a separate Node process from the rest of the API server. It subscribes to the RabbitMQ queue with `prefetch(10)`, parses and validates each message, and either processes it successfully - writing the raw event to MongoDB (treated as the critical write) and upserting an hourly rollup row in PostgreSQL (treated as best-effort, recomputing a running weighted average latency rather than overwriting it) - or routes it to a delayed retry or the dead-letter queue depending on whether the failure looks transient or not. It also handles its own reconnect-on-channel-close logic and graceful shutdown.


## Dataflow Diagram of Consumer Service


![Processor-dataflow-diagram](../../../public/dataflow-diagrams/consumer-dataflow-diagram.svg)
