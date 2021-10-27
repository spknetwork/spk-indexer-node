import { ApiProperty } from '@nestjs/swagger'

export class DocumentViewDto {
  @ApiProperty({
    description: 'The ceramic stream ID of the document',
  })
  streamId: string

  @ApiProperty({
    description:
      'The ceramic stream ID of the parent of the document (undefined if this is a top-level document)',
  })
  parentId?: string

  @ApiProperty({
    description: 'Document contents',
  })
  content: any
  @ApiProperty({
    description: 'The ID of the creator of this document',
  })
  creatorId: string

  static fromDocumentView(view: DocumentView): DocumentViewDto {
    return {
      streamId: view.stream_id,
      parentId: view.parent_id,
      content: view.content,
      creatorId: view.creator_id,
    }
  }
}

export interface DocumentView {
  stream_id: string

  parent_id?: string

  content: any
  creator_id: string
}
