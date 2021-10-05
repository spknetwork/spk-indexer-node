import { Express, Request, Response } from 'express'
import { PeersResult } from 'ipfs-core-types/src/swarm'
import { IPFSHTTPClient } from 'ipfs-http-client'

export interface DebugEndpointResponse {
  peers: PeersResult[]
}

const ipfsContainer: { ipfs: IPFSHTTPClient } = {} as any

export class DebugApiController {
  static register(app: Express, controllerPath: string, ipfs: IPFSHTTPClient) {
    ipfsContainer.ipfs = ipfs
    app.get(controllerPath, this.handle)
  }

  static async handle(request: Request, response: Response): Promise<void> {
    try {
      const info = await ipfsContainer.ipfs.swarm.peers()
      const debugResponse: DebugEndpointResponse = {
        peers: info,
      }

      const peerAddresses = info.map((item) => item.addr)

      response.json(peerAddresses)
    } catch (err) {
      response.send(`Error sending response ${err.message}`)
    }
  }
}
