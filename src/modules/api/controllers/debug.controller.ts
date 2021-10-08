import { Controller, Get, InternalServerErrorException } from '@nestjs/common'
import { indexerContainer, ipfsContainer } from '../indexer-api.module'
const IPFS_PUBSUB_TOPIC = '/spk.network/testnet-dev'
export interface DebugSummaryInfo {
  /**
   * Number of connected peer
   */
  peerCount: number
  /**
   * Peer ID of this node
   */
  peerId: string
  /**
   * peer info for this node (the multiaddresses of the ipfs node, comes from the same api for retrieving the peerid)
   */
  peerInfo: any
  /**
   * list of the IPFS pubsub peers
   */
  pubsubPeers: any
  /**
   * bandwidthStats (ipfs.stats.bw)
   */
  bandwidthStats: any
}

// Need to keep a top-level container here to avoid garbage collection
// @Controller(`${INDEXER_API_BASE_URL}/debug`)
@Controller(`/api/v0/node/debug`)
export class DebugApiController {
  constructor() {}

  @Get('')
  async getDebugSummaryInfo() {
    try {
      const peers = await ipfsContainer.self.swarm.peers()
      const selfId = await ipfsContainer.self.id()

      const pubsubPeersByTopic: Record<string, string[]> = {}
      // TODO - get these topics somewhere other than a local constant (i.e. either get them dynamically or get them from a common constants file)
      const peerTopics = [IPFS_PUBSUB_TOPIC]
      for (const topic of peerTopics) {
        const peersForTopic = await ipfsContainer.self.pubsub.peers(topic)
        pubsubPeersByTopic[topic] = peersForTopic
      }

      const bwStatIterable = ipfsContainer.self.stats.bw()
      const bwStats: any[] = []
      for await (const stat of bwStatIterable) {
        stat.totalIn = stat.totalIn.toString() as any
        stat.totalOut = stat.totalOut.toString() as any
        bwStats.push(stat)
      }

      const debugResponse: any = {
        peerCount: peers.length,
        peerId: selfId.id,
        peerInfo: selfId.addresses,
        pubsubPeers: pubsubPeersByTopic,
        bandwidthStats: bwStats,
      }

      return debugResponse
    } catch (err) {
      console.error(`error getting debug info!`, err.message)
      throw new InternalServerErrorException(`Error getting debug info! ${err.message}`)
    }
  }

  @Get('/peerlist')
  async getPeerList() {
    try {
      const peers = await ipfsContainer.self.swarm.peers()
      const peerAddresses = peers.map((item) => item.peer)

      return peerAddresses
    } catch (err) {
      throw new InternalServerErrorException(`Error getting peer list ${err.message}`)
    }
  }

  @Get('/dumpdatabase')
  async dumpDatabase() {
    try {
      const docs = await indexerContainer.self.getAllDocuments()
      const indexes = await indexerContainer.self.getAllIndexes()

      return {
        docsCount: docs.length,
        indexesCount: indexes.length,
        docs,
        indexes,
      }
    } catch (err) {
      throw new InternalServerErrorException(`Error dumping database ${err.message}`)
    }
  }
}
