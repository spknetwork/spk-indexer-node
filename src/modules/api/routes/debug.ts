import { Express, Request, response, Response } from 'express'
import { IPFSHTTPClient } from 'ipfs-http-client'
import PeerId from 'peer-id'
import { IPFS_PUBSUB_TOPIC } from '../../graph-indexer/services/custodian.service'

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
const ipfsContainer: { ipfs: IPFSHTTPClient } = {} as any

export class DebugApiController {
  static register(app: Express, controllerPath: string, ipfs: IPFSHTTPClient) {
    ipfsContainer.ipfs = ipfs
    app.get(`${controllerPath}/peerlist`, this.getPeerList)
    app.get(`${controllerPath}`, this.getDebugSummaryInfo)
  }

  static async getPeerList(request: Request, response: Response): Promise<void> {
    try {
      const info = await ipfsContainer.ipfs.swarm.peers()
      const peerAddresses = info.map((item) => PeerId.parse(item.peer).id)

      response.json(peerAddresses)
    } catch (err) {
      response.send(`Error getting peer list ${err.message}`)
    }
  }

  static async getDebugSummaryInfo(req: Request, res: Response) {
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

      const debugResponse: DebugSummaryInfo = {
        peerCount: peers.length,
        peerId: selfId.id,
        peerInfo: selfId.addresses,
        pubsubPeers: pubsubPeers,
        bandwidthStats: bwStats,
      }

      console.log(`debug response`, debugResponse)

      response.json(debugResponse)
    } catch (err) {
      console.error(`error getting debug info!`, err.message)
      response.send(`Error getting debug info! ${err.message}`)
    }
  }
}
