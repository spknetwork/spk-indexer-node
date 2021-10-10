import { Post } from '@nestjs/common'
import { Body } from '@nestjs/common'
import { Controller, Get, Param } from '@nestjs/common'
import { indexerContainer } from '../indexer-api.module'

// Need to keep a top-level container here to avoid garbage collection
// @Controller(`${INDEXER_API_BASE_URL}/debug`)
@Controller(`/api/v0/node/indexer`)
export class IndexerApiController {
  constructor() {}

  @Get('getdiscussion/:id')
  async getDiscussion(@Param('id') postId) {
    console.log(postId)
    const out = []
    for await (const item of indexerContainer.self.getDiscussion(postId)) {
      out.push(item)
    }
    return out
  }
  @Get('getcontent/:id')
  async getPost(@Param('id') postId) {
    return await indexerContainer.self.getPost(postId)
  }

  @Post('putdocument')
  async putDocument(@Body() data) {
    console.log(data)
  }
}
