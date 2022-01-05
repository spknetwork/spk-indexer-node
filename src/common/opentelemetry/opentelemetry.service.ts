import { JaegerExporter } from '@opentelemetry/exporter-jaeger'
import { Resource } from '@opentelemetry/resources'
import { NodeSDK, tracing } from '@opentelemetry/sdk-node'
import { BasicTracerProvider, SimpleSpanProcessor } from '@opentelemetry/sdk-trace-base'
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions'
import { trace, Tracer } from '@opentelemetry/api'

import { ConfigService } from '../../config.service'

// otel node https://opentelemetry.io/docs/instrumentation/js/getting-started/nodejs/
export class OpenTelemetryService {
  static sdk: NodeSDK
  static _tracer: Tracer
  static async start(): Promise<void> {
    const resource = new Resource({
      [SemanticResourceAttributes.SERVICE_NAME]: 'spk-indexer-node',
    })
    const tracerProvider = new BasicTracerProvider({
      resource,
      forceFlushTimeoutMillis: 1000,
    })

    this.sdk = new NodeSDK({
      resource,
      //       instrumentations: [getNodeAutoInstrumentations()],
    })

    tracerProvider.register({})
    tracerProvider.addSpanProcessor(
      new SimpleSpanProcessor(new JaegerExporter(ConfigService.getConfig().jaegerConfig)),
    )

    // Uncomment if console exporter is needed for testing
    //     if (ConfigService.getConfig().testMode) {
    //       tracerProvider.addSpanProcessor(new SimpleSpanProcessor(new tracing.ConsoleSpanExporter()))
    //     }

    await this.sdk.start()

    this._tracer = trace.getTracer('spk-tracer')
  }

  static async shutdown(): Promise<void> {
    await this.sdk.shutdown()
  }

  static getNewSpan(name: string) {
    return this._tracer.startSpan(name)
  }
}
