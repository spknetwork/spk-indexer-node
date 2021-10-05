import { IPFSHTTPClient } from 'ipfs-http-client'
import express from 'express'
import { DebugApiController } from './routes/debug'

const holder: any = {}

export class IndexerApiModule {
  constructor(private readonly ipfs: IPFSHTTPClient, private readonly listenPort: number) {}

  public listen() {
    const app = express()

    const debugController = DebugApiController.register(app, '/debug', this.ipfs)

    app.listen(this.listenPort, () => {
      console.log(`Indexer daemon API is listening on port ${this.listenPort}`)
    })
  }
}
