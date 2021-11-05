import { ApiProperty } from '@nestjs/swagger'
import { IndexedDocument } from '../../graph-indexer/graph-indexer.model'

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

  @ApiProperty({
    description: 'When the document was created in ceramic',
  })
  createdAt: Date

  static fromDocumentView(view: DocumentView): DocumentViewDto {
    return {
      streamId: view.stream_id,
      parentId: view.parent_id,
      content: view.content,
      creatorId: view.creator_id,
      createdAt: view.created_at,
    }
  }

  static fromIndexedDocument(doc: IndexedDocument): DocumentViewDto {
    return {
      streamId: doc.id,
      parentId: doc.parent_id,
      content: doc.content,
      creatorId: doc.creator_id,
      createdAt: doc.created_at,
    }
  }
}

export interface DocumentView {
  stream_id: string
  parent_id?: string
  content: any
  creator_id: string
  created_at: Date
}
