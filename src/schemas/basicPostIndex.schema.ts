import { JSONSchema7 } from 'json-schema'

export const basicPostIndex: JSONSchema7 = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  type: 'object',
  title: 'basicPostIndex',
  patternProperties: {
    '^([a-zA-Z]+(-[a-zA-Z]+)+)': {
      type: 'string',
      pattern: '^ceramic://.+',
    },
  },
  additionalProperties: false,
}
