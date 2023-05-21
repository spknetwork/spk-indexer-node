import { MongoClient } from 'mongodb'
import {CeramicClient} from '@ceramicnetwork/http-client'
import { ConfigService } from './config.service'
import { create as createIpfs } from 'ipfs-http-client'

import { CoreService } from './modules/graph-indexer/services/core.service'
import { IndexerApiModule } from './modules/api/indexer-api.module'
import { logger } from './common/logger.singleton'
import { OpenTelemetryService } from './common/opentelemetry/opentelemetry.service'

const NETWORK_ID = '/spk.network/testnet-dev' // Future use for network isolation

async function startup(): Promise<void> {
  // init ceramic
  const CERAMIC_HOST = ConfigService.getConfig().ceramicHost
  const ceramic = new CeramicClient(CERAMIC_HOST) //Using the public node for now.

  // Start tracer
  await OpenTelemetryService.start()

  // init mongo
  const MONGO_HOST = ConfigService.getConfig().mongoHost
  const url = `mongodb://${MONGO_HOST}`
  const mongo = new MongoClient(url)
  await mongo.connect()
  logger.info(`Connected successfully to mongo at ${MONGO_HOST}`)

  const instance = new CoreService(ceramic, mongo)
  await instance.start()

  // Start API
  const IPFS_HOST = ConfigService.getConfig().ipfsHost
  const API_LISTEN_PORT = ConfigService.getConfig().apiListenPort
  const SERVICE_VERSION = ConfigService.getConfig().serviceVersion
  const ipfs = createIpfs({ host: IPFS_HOST })
  const api = new IndexerApiModule(ipfs, API_LISTEN_PORT, instance)
  await api.listen()

  logger.info('Indexer node started!')
  logger.info(`Node version: ${process.version}`)
  logger.info(`Service version: ${SERVICE_VERSION}`)
  logger.info(`API listen port: ${API_LISTEN_PORT}`)
  logger.info(`Ceramic host: ${CERAMIC_HOST}`)
  logger.info(`Mongo host: ${MONGO_HOST}`)
  logger.info(`IPFS host: ${IPFS_HOST}`)
}

void startup()

// Process-wide exception handlers:
//TODO: Figure out where and why ceramic cannot recovery from errors. How to handle ceramic temporarily failing.
process.on('unhandledRejection', (err: Error) => {
  logger.error(`Unhandled rejection!`)
  logger.error(err.message)
  logger.error(err.stack)
  logger.error(`Halting process with error code 1.`)
  process.exit(1)
})

process.on('uncaughtException', (err: Error) => {
  logger.error(`Uncaught exception!`)
  logger.error(err.message)
  logger.error(err.stack)
  logger.error(`Halting process with error code 1.`)
  process.exit(1)
})

process.on('SIGTERM', () => {
  OpenTelemetryService.shutdown()
    .then(
      () => logger.info('Tracer shut down successfully'),
      (err) => logger.error(`Error shutting down tracer: ${err.message}`),
    )
    .finally(() => process.exit(0))
})
