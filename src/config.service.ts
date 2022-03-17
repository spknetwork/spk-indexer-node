import { ExporterConfig as JaegerConfig } from '@opentelemetry/exporter-jaeger'

export interface IndexerAppConfig {
  mongoDatabaseName: string
  mongoHost: string
  ceramicHost: string
  ipfsHost: string
  apiListenPort: number
  testMode: boolean
  jaegerConfig: JaegerConfig
  serviceVersion: string
  enableCors: boolean
}

// see config example https://www.npmjs.com/package/@opentelemetry/exporter-jaeger
function getJaegerConfig(): JaegerConfig {
  let jaegerPort
  if (process.env.JAEGER_PORT) {
    try {
      jaegerPort = parseInt(process.env.JAEGER_PORT)
    } catch (err) {
      throw new Error(
        `Error parsing api listen port!  ${process.env.JAEGER_PORT} is not a valid number`,
      )
    }
  } else {
    jaegerPort = 6832
  }

  return {
    host: process.env.JAEGER_HOST || 'localhost',
    port: jaegerPort,
    maxPacketSize: 65000,
  }
}

export class ConfigService {
  static getConfig(): IndexerAppConfig {
    let apiListenPort
    if (process.env.API_LISTEN_PORT) {
      try {
        apiListenPort = parseInt(process.env.API_LISTEN_PORT)
      } catch (err) {
        throw new Error(
          `Error parsing api listen port!  ${process.env.API_LISTEN_PORT} is not a valid number`,
        )
      }
    } else {
      apiListenPort = 4567
    }

    return {
      mongoDatabaseName: process.env.MONGO_DATABASE || 'spk-indexer-test',
      mongoHost: process.env.MONGO_HOST || 'localhost:27017',
      ceramicHost: process.env.CERAMIC_HOST || 'https://d12-b-ceramic.3boxlabs.com',
      ipfsHost: process.env.IPFS_HOST || 'localhost:5001',
      apiListenPort,
      testMode: process.env.TEST_MODE === 'true',
      jaegerConfig: getJaegerConfig(),
      serviceVersion: process.env.npm_package_version,
      enableCors: true,
    }
  }
}
