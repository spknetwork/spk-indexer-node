import { JSONSchema7 } from 'json-schema'
import { CeramicClient } from '@ceramicnetwork/http-client'
import { IndexedDocument } from '../../types/indexedDocument.type'
import { NotImplementedException } from '../../exceptions/not-implemented.exception'
import { MongoService } from '../mongo-access/mongo.service'
import { MongoClient } from 'mongodb'

export class SchemaValidator {
  ceramic: CeramicClient
  mongoService: MongoService
  constructor(ceramic: CeramicClient, mongoClient: MongoClient) {
    this.ceramic = ceramic
    this.mongoService = new MongoService(mongoClient)
  }

  /**
   * Registers schema with indexer
   */
  public async registerSchema(schemaStreamId: string): Promise<void> {
    // TODO - register schema with mongo collection
    throw new NotImplementedException()
  }

  /**
   * Deregisters schema with indexer
   */
  public async deregisterSchema(schemaStreamId: string) {
    // TODO - deregister schema with mongo collection
    throw new NotImplementedException('deregisterSchema')
  }

  /**
   * Crawls indexed subgraph and validates schema of each document in the subgraph vs the advertised schema
   */
  public async validateSubgraphsVsSchema(subgraphRoots: IndexedDocument[], schemaId: string) {
    throw new NotImplementedException('validateSubgraphVsSchema')
  }

  /**
   * Query peers for root node of subgraphs matching a specified schema
   */
  public async queryPeersForSubgraphs(schemaIds: string[]) {
    /**
 	1. When registering pull schema from Ceramic using streamID. (Cache in mongodb). Add schemaID to list in memory.
	2. When deregistering remove schemaID from in memory list. Optionally remove from database cache (maybe have an expiration in the future?) (For now garbage collection isn't very important, I am fine with skipping removal from caches)
 	*/
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
