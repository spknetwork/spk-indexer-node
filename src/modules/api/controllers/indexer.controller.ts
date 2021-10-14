import {
  BadRequestException,
  HttpCode,
  HttpStatus,
  InternalServerErrorException,
  Put,
  Query,
} from '@nestjs/common'
import { Controller, Get, Param } from '@nestjs/common'
import { ApiNotFoundResponse, ApiOkResponse, ApiQuery } from '@nestjs/swagger'
import { indexerContainer } from '../indexer-api.module'
import { DocumentView } from '../resources/document.view'

// Need to keep a top-level container here to avoid garbage collection
// @Controller(`${INDEXER_API_BASE_URL}/debug`)
@Controller(`/api/v0/node/indexer`)
export class IndexerApiController {
  constructor() {}

  @Put('index/:documentStreamId')
  @ApiOkResponse({ description: 'The document was found and indexed' })
  @ApiNotFoundResponse({ description: 'The document was not found on ceramic' })
  public async indexDocument(@Param('documentStreamId') streamId: string) {
    throw new InternalServerErrorException('not implemented')
  }

  @Get(':documentStreamId')
  @ApiOkResponse({ description: 'The document with the specified stream ID', type: DocumentView })
  @HttpCode(HttpStatus.OK)
  public async fetchDocument(@Param('documentStreamId') streamId: string) {
    throw new InternalServerErrorException('not implemented')
  }

  @Get('foruser/:userId')
  @ApiOkResponse({ description: 'Documents for the user', type: [DocumentView] })
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
    const userDocs: DocumentView[] = []

    for await (const item of indexerContainer.self.getForUser(userId, recordsToSkip, pageSize)) {
      userDocs.push(item)
    }

    return userDocs
  }

  @Get('children/:documentStreamId')
  @ApiOkResponse({
    description: 'Array of children of the provided document stream ID',
    type: [DocumentView],
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
    const children: DocumentView[] = []

    for await (const item of indexerContainer.self.getChildren(parentId, recordsToSkip, pageSize)) {
      children.push(item)
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
