import CeramicHTTP from '@ceramicnetwork/http-client'

import { Core } from './core'

const NETWORK_ID = '/spk.network/testnet-dev' // Future use for network isolation

const docDef = {
  author: String, // DID
  id: String, // StreamID
  parent_author: String, // DID
  parent_id: String, // StreamID
  content: Object,
}
async function startup(): Promise<void> {
  const ceramic = new CeramicHTTP('https://ceramic-clay.3boxlabs.com') //Using the public node for now.
  const instance = new Core(ceramic)
  await instance.start()
  await instance.postSpider.pullSingle(
    `did:3:kjzl6cwe1jw147v2fzxjvpbvjp87glksoi2p698t6bbhuv2cuc3vie7kcopvyfb`,
  )
}

void startup()
