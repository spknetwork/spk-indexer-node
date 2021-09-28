import CeramicHTTP from '@ceramicnetwork/http-client'
import { MongoClient } from 'mongodb'

import { CoreService } from './modules/graph-indexer/services/core.service'
import { MONGO_HOST } from './modules/mongo-access/mongo.constants'

const NETWORK_ID = '/spk.network/testnet-dev' // Future use for network isolation

async function startup(): Promise<void> {
  // init ceramic
  const ceramic = new CeramicHTTP('https://ceramic-clay.3boxlabs.com') //Using the public node for now.

  // init mongo
  const url = `mongodb://${MONGO_HOST}`
  const mongo = new MongoClient(url)
  await mongo.connect()
  console.log('Connected successfully to mongo')

  const instance = new CoreService(ceramic, mongo)
  await instance.start()
  await instance.postSpider.pullSingle(
    `did:3:kjzl6cwe1jw147v2fzxjvpbvjp87glksoi2p698t6bbhuv2cuc3vie7kcopvyfb`,
  )
}

void startup()
