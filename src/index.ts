import CeramicHTTP from '@ceramicnetwork/http-client'
import { MongoClient } from 'mongodb'
import { ConfigService } from './config.service'
import IPFSHTTP from 'ipfs-http-client'

import { CoreService } from './modules/graph-indexer/services/core.service'
import { IndexerApiModule } from './modules/api/indexer-api.module'
import { logger } from './common/logger.singleton'

const NETWORK_ID = '/spk.network/testnet-dev' // Future use for network isolation

async function startup(): Promise<void> {
  // init ceramic
  const CERAMIC_HOST = ConfigService.getConfig().ceramicHost
  const ceramic = new CeramicHTTP(CERAMIC_HOST) //Using the public node for now.

  // init mongo
  const MONGO_HOST = ConfigService.getConfig().mongoHost
  const url = `mongodb://${MONGO_HOST}`
  const mongo = new MongoClient(url)
  await mongo.connect()
  logger.info(`Connected successfully to mongo at ${MONGO_HOST}`)

  const instance = new CoreService(ceramic, mongo)
  await instance.start()
  await instance.postSpider.pullSingle(
    `did:3:kjzl6cwe1jw147v2fzxjvpbvjp87glksoi2p698t6bbhuv2cuc3vie7kcopvyfb`,
  )

  // Start API
  const IPFS_HOST = ConfigService.getConfig().ipfsHost
  const API_LISTEN_PORT = ConfigService.getConfig().apiListenPort
  const ipfs = IPFSHTTP.create({ host: IPFS_HOST })
  const api = new IndexerApiModule(ipfs, API_LISTEN_PORT, instance)
  await api.listen()

  logger.info('Indexer node started!')
  logger.info(`API listen port: ${API_LISTEN_PORT}`)
  logger.info(`Ceramic host: ${CERAMIC_HOST}`)
  logger.info(`Mongo host: ${MONGO_HOST}`)
  logger.info(`IPFS host: ${IPFS_HOST}`)
}

void startup()

// Process-wide exception handlers:
//I want to let major errors crash the program so it can be restarted..
//Right now when errors are thrown they don't cause a fail state and the entire daemon goes into limbo state.
//TODO: Figure out where and why ceramic cannot recovery from errors. How to handle ceramic temporarily failing.
/*process.on('unhandledRejection', (error: Error) => {
  console.log('unhandledRejection', error.message)
})*/
