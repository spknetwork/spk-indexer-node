import { Controller, Get, InternalServerErrorException } from '@nestjs/common'
import PeerId from 'peer-id'
import { ipfsContainer } from '../indexer-api.module'
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
      const peers = await ipfsContainer.ipfs.swarm.peers()
      const selfId = await ipfsContainer.ipfs.id()
      const pubsubPeers = await ipfsContainer.ipfs.pubsub.peers(IPFS_PUBSUB_TOPIC)
      const bwStatIterable = ipfsContainer.ipfs.stats.bw()
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
        pubsubPeers: pubsubPeers,
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
      const info = await ipfsContainer.ipfs.swarm.peers()
      const peerAddresses = info.map((item) => PeerId.parse(item.peer).id)

      return peerAddresses
    } catch (err) {
      throw new InternalServerErrorException(`Error getting peer list ${err.message}`)
    }
  }
}
