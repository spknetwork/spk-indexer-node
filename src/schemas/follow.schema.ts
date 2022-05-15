import { JSONSchema7 } from 'json-schema'

export const basicPostSchema: JSONSchema7 = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  type: 'object',
  title: 'basicPost',
  patternProperties: {
    target: {
      type: 'string',
    },
    target_type: {
      type: 'string', //Ceramic account, blockchain account, etc
    },
    timestamp: {
      type: 'string',
    },
  },
  additionalProperties: false,
}
