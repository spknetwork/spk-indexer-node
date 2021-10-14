import { ApiProperty } from '@nestjs/swagger'

export class DocumentView {
  @ApiProperty({
    description: 'The ceramic stream ID of the document',
  })
  streamId: string

  @ApiProperty({
    description:
      'The ceramic stream ID of the parent of the document (null if this is a top-level document)',
  })
  parent_id: string

  @ApiProperty({
    description: 'Document contents',
  })
  content: any
  @ApiProperty({
    description: 'The ID of the creator of this document',
  })
  creator_id: string
}
