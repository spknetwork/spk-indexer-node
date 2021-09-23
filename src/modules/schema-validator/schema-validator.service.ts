import { JSONSchema7 } from 'json-schema'
import { CeramicClient } from '@ceramicnetwork/http-client'
import { TileDocument } from '@ceramicnetwork/stream-tile'
import { IndexedDocument } from '../../types/indexedDocument.type'
import { NotImplementedException } from '../../exceptions/not-implemented.exception'

export class SchemaValidator {
  ceramic: CeramicClient
  constructor(ceramic: CeramicClient) {
    this.ceramic = ceramic
  }

  /**
   * Registers schema with ceramic
   */
  public async registerSchema(schema: JSONSchema7): Promise<TileDocument> {
    // TODO - figure out if we need to capture and index the ceramic ID of the schema

    const created = await TileDocument.create(
      this.ceramic,
      {
        $schema: 'http://json-schema.org/draft-07/schema#',
        title: 'QuickStartSchema',
        type: 'object',
        properties: {
          id: { type: 'string' },
          foo: { type: 'string' },
          revision: { type: 'number' },
        },
        required: ['foo'],
      },
      {
        controllers: [this.ceramic?.did?.id || ''],
        family: 'schema',
      },
    )

    return created
  }

  /**
   * Deregisters schema with ceramic
   */
  public async deregisterSchema(schema: JSONSchema7) {
    // TODO - figure out if we can deregister a schema based on the schema definition itself or if we need the ceramic document ID
    throw new NotImplementedException('deregisterSchema')
  }

  /**
   * Crawls indexed subgraph and validates schema of each document in the subgraph vs the advertised schema
   */
  public async validateSubgraphVsSchema(subgraphRoot: IndexedDocument, schema: JSONSchema7) {
    throw new NotImplementedException('validateSubgraphVsSchema')
  }

  /**
   * Query peers for root node of subgraphs matching a specified schema
   */
  public async queryPeersForSubgraphs(schemas: JSONSchema7[]) {
    throw new NotImplementedException()
  }

  /**
   * Respond to query from peers asking for subgraphs matching a specific schema
   */
  public async getSubgraphsMatchingSchemas(schema: JSONSchema7[]) {
    throw new NotImplementedException()
  }

  /**
   * From a provided root subgraph node, create an index of the schema(s) in the subgraph for quick retrieval of datasets using a given set of schemas
   */
  public async createSubgraphSchemaIndex(subgraph: IndexedDocument) {
    throw new NotImplementedException()
  }
}
