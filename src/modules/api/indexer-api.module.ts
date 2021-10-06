import { IPFSHTTPClient } from 'ipfs-http-client'
import express from 'express'
import { DebugApiController } from './routes/debug'

const holder: any = {}

const INDEXER_API_BASE_URL = '/api/v0/node'

/**
 * see api requirements here https://github.com/3speaknetwork/research/discussions/3
 */
export class IndexerApiModule {
  constructor(private readonly ipfs: IPFSHTTPClient, private readonly listenPort: number) {}

  public listen() {
    const app = express()
    app.use(express.json())

    DebugApiController.register(app, `${INDEXER_API_BASE_URL}/debug`, this.ipfs)

    app.listen(this.listenPort, () => {
      console.log(`Indexer daemon API is listening on port ${this.listenPort}`)
    })
  }
}
