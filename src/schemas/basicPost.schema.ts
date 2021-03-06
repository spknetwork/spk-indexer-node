import { JSONSchema7 } from 'json-schema'

export const basicPostSchema: JSONSchema7 = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  type: 'object',
  title: 'basicPost',
  patternProperties: {
    content_obj: {
      type: 'object',
    },
    content: {
      type: 'string',
      pattern: '^ceramic://.+',
    },
    created_at: {
      type: 'string',
      format: 'date',
    },
    app: {
      type: 'string',
      maxLength: 64,
      description: 'The identifier of the app writing this data',
    },
    type: {
      type: 'string',
      maxLength: 64,
      description: 'The type of data. For example 3speak/video',
    },
    parent_id: {
      type: 'string',
      pattern: '^ceramic://.+',
    },
  },
  additionalProperties: false,
}
