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
export const NULL_DID = 'did:key:z6MkeTG3bFFSLYVU7VqhgZxqr6YzpaGrQtFMh1uvqGy1vDnP' // Null address should go to an empty ed25519 key

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
      ceramicHost: process.env.CERAMIC_HOST || 'https://ceramic.web3telekom.xyz',
      ipfsHost: process.env.IPFS_HOST || '127.0.0.1:5001',
      apiListenPort,
      testMode: process.env.TEST_MODE === 'true',
      jaegerConfig: getJaegerConfig(),
      serviceVersion: process.env.npm_package_version,
      enableCors: true,
    }
  }
}
