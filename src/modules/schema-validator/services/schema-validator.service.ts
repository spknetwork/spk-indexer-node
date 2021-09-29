import { CeramicClient } from '@ceramicnetwork/http-client'
import { RepoManager } from '../../mongo-access/services/repo-manager.service'
import { TileDocument } from '@ceramicnetwork/stream-tile'
import Ajv from 'ajv'
import { StoredSchema } from '../schema-validator.model'
import { MongoRepository } from '../../mongo-access/mongo-repository.generic'
import addFormats from 'ajv-formats'
import { NotFoundException, NotImplementedException } from '../../../common/indexer-app.exceptions'
import { IndexedDocument } from '../../graph-indexer/graph-indexer.model'

export class SchemaValidatorService {
  private readonly schemas: MongoRepository<StoredSchema>
  constructor(private readonly ceramic: CeramicClient, private readonly repoManager: RepoManager) {
    this.schemas = repoManager.storedSchemas
  }

  /**
   * Registers schema with indexer
   */
  public async registerSchema(schemaStreamId: string): Promise<void> {
    // Get schema doc from ceramic
    //     const schemaDoc = await TileDocument.load(this.ceramic, schemaStreamId)
    const schemaDoc = await this.ceramic.loadStream<TileDocument>(schemaStreamId)
    if (!schemaDoc) {
      throw new NotFoundException(
        `Could not find schema with stream ID ${schemaStreamId} in ceramic!`,
      )
    }

    const ajv = new Ajv()
    addFormats(ajv)
    // Make sure the contents of the retrieved doc are a valid json schema by trying compilation with ajv
    try {
      ajv.compile(schemaDoc.state.content)
    } catch (err) {
      throw new Error(
        `Error registering schema!  Contents of doc at streamID ${schemaStreamId} is not a valid JSON schema object! ${err.message}`,
      )
    }

    // Make sure this schema is not already registered in the database
    const existing = await this.repoManager.storedSchemas.findById(schemaStreamId)
    if (existing) {
      throw new Error(
        `Schema with stream ID ${schemaStreamId} is already registered with the database!`,
      )
    }

    await this.repoManager.storedSchemas.insertOne({
      id: schemaStreamId,
      schema: schemaDoc.content,
    } as StoredSchema)
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
  public async getSubgraphsMatchingSchemas(schema: string[]) {
    throw new NotImplementedException()
  }

  /**
   * From a provided root subgraph node, create an index of the schema(s) in the subgraph for quick retrieval of datasets using a given set of schemas
   */
  public async createSubgraphSchemaIndex(subgraph: IndexedDocument) {
    throw new NotImplementedException()
  }
}
