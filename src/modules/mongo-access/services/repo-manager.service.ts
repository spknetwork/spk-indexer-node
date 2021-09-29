import { Db, MongoClient } from 'mongodb'
import { ConfigService } from '../../../config.service'
import { IndexedDocument, IndexedNode } from '../../graph-indexer/graph-indexer.model'
import { StoredSchema } from '../../schema-validator/schema-validator.model'
import { MongoRepository } from '../mongo-repository.generic'
import { MongoCollections } from '../mongo-access.model'

export class RepoManager {
  private _indexedDocs: MongoRepository<IndexedDocument>
  private _graphIndex: MongoRepository<IndexedNode>
  private _storedSchemas: MongoRepository<StoredSchema>
  private readonly _db: Db

  constructor(private readonly _mongoClient: MongoClient) {
    this._db = _mongoClient.db(ConfigService.getConfig().mongoDatabaseName)
  }

  get indexedDocs(): MongoRepository<IndexedDocument> {
    if (!this.indexedDocs) {
      this._indexedDocs = new MongoRepository(this._db, MongoCollections.IndexedDocs)
    }
    return this._indexedDocs
  }

  get graphIndex(): MongoRepository<IndexedNode> {
    if (!this.graphIndex) {
      this._graphIndex = new MongoRepository(this._db, MongoCollections.GraphIndex)
    }
    return this._graphIndex
  }

  get storedSchemas(): MongoRepository<StoredSchema> {
    if (!this._storedSchemas) {
      this._storedSchemas = new MongoRepository(this._db, MongoCollections.StoredSchemas)
    }
    return this._storedSchemas
  }
}
