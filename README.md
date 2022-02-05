# spk-indexer-node

Experimental indexing system for the SPK network. At the moment this is meant only for development + testing purposes

# Developing

## IPFS and Mongodb

A local instance of IPFS with the `--enable-pubsub-experiment` enabled is required, as well as an instance of mongodb.

To start these dependencies, you can run `docker-compose up` from the `./dev_containers` directory.

# Opentelemetry with Jaeger

You may optionally enable [OpenTelemetry](https://opentelemetry.io/) by providing values for these environment variables:

```
JAEGER_HOST: the network host where Jaeger is running.  Default: localhost.
JAEGER_PORT: the port where the jaeger agent is listening for spans.  Default: 6832.
```

If you are not sure how to run a jaeger instance, you can use the jaeger `all-in-one` container in `./dev_containers/jaeger/docker-compose.yml`.

# License

MIT
