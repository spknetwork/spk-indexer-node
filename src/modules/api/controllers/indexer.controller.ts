import { BadRequestException, HttpCode, HttpStatus, Put, Query } from '@nestjs/common'
import { Controller, Get, Param } from '@nestjs/common'
import { ApiAcceptedResponse, ApiNotFoundResponse, ApiOkResponse, ApiQuery } from '@nestjs/swagger'
import { indexerContainer } from '../indexer-api.module'
import { DocumentViewDto } from '../resources/document.view'

// Need to keep a top-level container here to avoid garbage collection
// @Controller(`${INDEXER_API_BASE_URL}/debug`)
@Controller(`/api/v0/indexer`)
export class IndexerApiController {
  constructor() {}

  @Put('index/:documentStreamId')
  @ApiAcceptedResponse({ description: 'The document was found and indexed' })
  @ApiNotFoundResponse({ description: 'The document was not found on ceramic' })
  @HttpCode(HttpStatus.ACCEPTED)
  public async indexDocument(@Param('documentStreamId') streamId: string): Promise<void> {
    void indexerContainer.self.reindexDocument(streamId)
  }

  @Get('documents/:documentStreamId')
  @ApiOkResponse({
    description: 'The document with the specified stream ID',
    type: DocumentViewDto,
  })
  @HttpCode(HttpStatus.OK)
  public async fetchDocument(
    @Param('documentStreamId') streamId: string,
  ): Promise<DocumentViewDto> {
    const doc = await indexerContainer.self.getPost(streamId)
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
  public async getDocumentsForUser(
    @Query('userId') userId: string,
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

    // Process request
    // Fetch user-owned documents
    const userDocs: DocumentViewDto[] = []

    for await (const item of indexerContainer.self.getForUser(userId, recordsToSkip, pageSize)) {
      userDocs.push(DocumentViewDto.fromDocumentView(item))
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
  public async getChildren(
    @Query('parentId') parentId: string,
    @Query('page') page?: number | string,
    @Query('pageSize') pageSize?: number | string,
  ) {
    console.log(parentId)
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

    for await (const item of indexerContainer.self.getChildren(parentId, recordsToSkip, pageSize)) {
      children.push(DocumentViewDto.fromDocumentView(item))
    }

    return children
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
