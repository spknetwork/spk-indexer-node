import CeramicHTTP from '@ceramicnetwork/http-client'
import { MongoClient } from 'mongodb'
import { ConfigService } from './config.service'
import IPFSHTTP from 'ipfs-http-client'

import { CoreService } from './modules/graph-indexer/services/core.service'
import { IndexerApiModule } from './modules/api/indexer-api.module'

const NETWORK_ID = '/spk.network/testnet-dev' // Future use for network isolation

async function startup(): Promise<void> {
  // init ceramic
  const ceramic = new CeramicHTTP(ConfigService.getConfig().ceramicHost) //Using the public node for now.

  // init mongo
  const url = `mongodb://${ConfigService.getConfig().mongoHost}`
  const mongo = new MongoClient(url)
  await mongo.connect()
  console.log('Connected successfully to mongo')

  const instance = new CoreService(ceramic, mongo)
  await instance.start()
  await instance.postSpider.pullSingle(
    `did:3:kjzl6cwe1jw147v2fzxjvpbvjp87glksoi2p698t6bbhuv2cuc3vie7kcopvyfb`,
  )

  // Start API
  const ipfs = IPFSHTTP.create({ host: ConfigService.getConfig().ipfsHost })
  const api = new IndexerApiModule(ipfs, ConfigService.getConfig().apiListenPort)
  await api.listen()
}

void startup()
