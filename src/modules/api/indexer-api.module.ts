import { Module } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'
import { IPFSHTTPClient } from 'ipfs-http-client'
import { CoreService } from '../graph-indexer/services/core.service'
import { DebugApiController } from './controllers/debug.controller'
import { HealthApiController } from './controllers/health.controller'
import { IndexerApiController } from './controllers/indexer.controller'

export const ipfsContainer: { self: IPFSHTTPClient } = {} as any
export const indexerContainer: { self: CoreService } = {} as any

export const INDEXER_API_BASE_URL = '/api/v0/node'

@Module({
  imports: [],
  controllers: [DebugApiController, IndexerApiController, HealthApiController],
  providers: [],
})
class ControllerModule {}

/**
 * see api requirements here https://github.com/3speaknetwork/research/discussions/3
 */
export class IndexerApiModule {
  constructor(
    private readonly ipfs: IPFSHTTPClient,
    private readonly listenPort: number,
    private readonly self: CoreService,
  ) {
    ipfsContainer.self = ipfs
    indexerContainer.self = self
  }

  public async listen() {
    const app = await NestFactory.create(ControllerModule)

    const swaggerconfig = new DocumentBuilder().setTitle('SPK Indexer Daemon').build()
    const swaggerDocument = SwaggerModule.createDocument(app, swaggerconfig)
    SwaggerModule.setup('swagger', app, swaggerDocument)

    await app.listen(this.listenPort)
  }
}
