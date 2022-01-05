import {
  BadRequestException,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Query,
  UseInterceptors,
} from '@nestjs/common'
import { ApiAcceptedResponse, ApiNotFoundResponse, ApiOkResponse, ApiQuery } from '@nestjs/swagger'
import { Span } from '@opentelemetry/api'

import { OpenTelemetryInterceptor } from '../../../common/opentelemetry/opentelemetry.interceptor'
import { RequestSpan } from '../../../common/opentelemetry/request-span.decorator'
import { DocSortOption } from '../../graph-indexer/graph-indexer.model'
import { indexerContainer } from '../indexer-api.module'
import { DocumentViewDto } from '../resources/document.view'

// Need to keep a top-level container here to avoid garbage collection
// @Controller(`${INDEXER_API_BASE_URL}/debug`)
@Controller(`/api/v0/indexer`)
@UseInterceptors(OpenTelemetryInterceptor)
export class IndexerApiController {
  constructor() {}

  @Put('index/:documentStreamId')
  @ApiAcceptedResponse({ description: 'The document was found and indexed' })
  @ApiNotFoundResponse({ description: 'The document was not found on ceramic' })
  @HttpCode(HttpStatus.ACCEPTED)
  public async reindexDocument(
    @Param('documentStreamId') streamId: string,
    @RequestSpan() span: Span,
  ): Promise<void> {
    span.setAttribute('stream_id', streamId)
    await indexerContainer.self.docCacheService.refreshCachedDoc(streamId)
  }

  @Post('index/:documentStreamId')
  @ApiAcceptedResponse({ description: 'The document was found and indexed' })
  @ApiNotFoundResponse({ description: 'The document was not found on ceramic' })
  @HttpCode(HttpStatus.CREATED)
  public async indexDocument(
    @Param('documentStreamId') streamId: string,
    @RequestSpan() span: Span,
  ): Promise<void> {
    span.setAttribute('stream_id', streamId)
    await indexerContainer.self.docCacheService.initializeCachedDoc(streamId, span)
  }

  @Get('documents/:documentStreamId')
  @ApiOkResponse({
    description: 'The document with the specified stream ID',
    type: DocumentViewDto,
  })
  @HttpCode(HttpStatus.OK)
  public async fetchDocument(
    @Param('documentStreamId') streamId: string,
    @RequestSpan() span: Span,
  ): Promise<DocumentViewDto> {
    span.setAttribute('stream_id', streamId)
    const doc = await indexerContainer.self.docCacheService.getDocument(streamId, span)
    return DocumentViewDto.fromDocumentView(doc)
  }

  @Get('foruser/userdocuments')
  @ApiOkResponse({ description: 'Documents for the user', type: [DocumentViewDto] })
  @ApiQuery({
    name: 'userId',
    required: true,
    type: String,
  })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
  })
  @ApiQuery({
    name: 'pageSize',
    required: false,
    type: Number,
  })
  @ApiQuery({
    name: 'sort',
    required: false,
    type: String,
  })
  public async getDocumentsForUser(
    @RequestSpan() span: Span,
    @Query('userId') userId: string,
    @Query('page') page?: number | string,
    @Query('pageSize') pageSize?: number | string,
    @Query('sort') sort?: DocSortOption,
  ) {
    span.setAttribute('user_id', userId)
    // Validate page parameters
    if (!page) page = 1
    if (!pageSize) pageSize = 25

    page = parseInt(page.toString(), 10)
    pageSize = parseInt(pageSize.toString(), 10)
    if (isNaN(page) || isNaN(pageSize))
      throw new BadRequestException('Both page and pageSize must be integers!')

    if (page < 1) throw new BadRequestException("'page' must be greater than or equal to 1")
    if (pageSize < 1) throw new BadRequestException("'pageSize' must be greater than or equal to 1")

    const recordsToSkip = IndexerApiController.calculateSkip(pageSize, page)

    // Process request
    // Fetch user-owned documents
    const userDocs: DocumentViewDto[] = []

    for await (const item of indexerContainer.self.docCacheService.getDocsForUser(
      userId,
      recordsToSkip,
      pageSize,
      sort,
    )) {
      userDocs.push(item)
    }

    return userDocs
  }

  @Get('children')
  @ApiOkResponse({
    description: 'Array of children of the provided document stream ID',
    type: [DocumentViewDto],
  })
  @ApiQuery({
    name: 'parentId',
    required: true,
    type: String,
  })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
  })
  @ApiQuery({
    name: 'pageSize',
    required: false,
    type: Number,
  })
  @ApiQuery({
    name: 'sort',
    required: false,
    type: String,
  })
  public async getChildren(
    @RequestSpan() span: Span,
    @Query('parentId') parentId: string,
    @Query('page') page?: number | string,
    @Query('pageSize') pageSize?: number | string,
    @Query('sort') sort?: DocSortOption,
  ) {
    span.setAttribute('parent_id', parentId)
    // Validate page parameters
    if (!page) page = 1
    if (!pageSize) pageSize = 25

    page = parseInt(page.toString(), 10)
    pageSize = parseInt(pageSize.toString(), 10)
    if (isNaN(page) || isNaN(pageSize))
      throw new BadRequestException('Both page and pageSize must be integers!')

    if (page < 1) throw new BadRequestException("'page' must be greater than or equal to 1")
    if (pageSize < 1) throw new BadRequestException("'pageSize' must be greater than or equal to 1")

    const recordsToSkip = IndexerApiController.calculateSkip(pageSize, page)

    // Fetch child documents
    const children: DocumentViewDto[] = []

    for await (const item of indexerContainer.self.docCacheService.getDocChildren(
      parentId,
      recordsToSkip,
      pageSize,
      sort,
    )) {
      children.push(item)
    }

    return children
  }

  @Get('feed')
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
  })
  @ApiQuery({
    name: 'pageSize',
    required: false,
    type: Number,
  })
  public async getFeed(
    @RequestSpan() span: Span,
    @Query('page') page?: number | string,
    @Query('pageSize') pageSize?: number | string,
  ) {
    // Validate page parameters
    if (!page) page = 1
    if (!pageSize) pageSize = 25

    page = parseInt(page.toString(), 10)
    pageSize = parseInt(pageSize.toString(), 10)
    if (isNaN(page) || isNaN(pageSize))
      throw new BadRequestException('Both page and pageSize must be integers!')

    if (page < 1) throw new BadRequestException("'page' must be greater than or equal to 1")
    if (pageSize < 1) throw new BadRequestException("'pageSize' must be greater than or equal to 1")

    const recordsToSkip = IndexerApiController.calculateSkip(pageSize, page)

    const data = await indexerContainer.self.graphDocs
      .find(
        {},
        {
          skip: recordsToSkip,
          limit: pageSize,
          sort: {
            first_seen: -1,
          },
        },
      )
      .toArray()

    const out = data.map((e) => {
      delete e._id

      return {
        id: e.id,
        content: e.content,
        parent_id: e.parent_id,
        first_seen: e.first_seen,
        last_updated: e.last_updated,
        creator_id: e.creator_id,
        version_id: e.version_id,
      }
    })

    return out
  }
  static calculateSkip(size: number | string, page: number | string): number {
    size = parseInt(size.toString(), 10)
    page = parseInt(page.toString(), 10)

    if (page <= 0) {
      page = 1
    }
    if (size < 1) {
      size = 1
    }
    return (page - 1) * size
  }
}
