import { Module } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'
import { IPFSHTTPClient } from 'ipfs-http-client'
import { DebugApiController } from './controllers/debug.controller'

export const ipfsContainer: { ipfs: IPFSHTTPClient } = {} as any

export const INDEXER_API_BASE_URL = '/api/v0/node'

@Module({
  imports: [],
  controllers: [DebugApiController],
  providers: [],
})
class ControllerModule {}

/**
 * see api requirements here https://github.com/3speaknetwork/research/discussions/3
 */
export class IndexerApiModule {
  constructor(private readonly ipfs: IPFSHTTPClient, private readonly listenPort: number) {
    ipfsContainer.ipfs = ipfs
  }

  public async listen() {
    const app = await NestFactory.create(ControllerModule)

    const swaggerconfig = new DocumentBuilder().setTitle('SPK Indexer Daemon').build()
    const swaggerDocument = SwaggerModule.createDocument(app, swaggerconfig)
    SwaggerModule.setup('swagger', app, swaggerDocument)

    await app.listen(this.listenPort)
  }
}
