import { ApiProperty } from '@nestjs/swagger'
import { DocumentView, DocumentViewDto } from './document.view'

export class UserDocumentViewDto extends DocumentViewDto {
  @ApiProperty({
    description: 'the permlink of the user document',
  })
  permlink?: string

  static fromDocumentView(view: DocumentView, permlink?: string): UserDocumentViewDto {
    return {
      streamId: view.stream_id,
      parentId: view.parent_id,
      content: view.content,
      creatorId: view.creator_id,
      createdAt: view.created_at,
      updatedAt: view.updated_at,
      permlink,
    }
  }
}
