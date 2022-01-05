import { Collection, Db, Filter, InsertOneResult, OptionalId } from 'mongodb'
import { DataCorruptedException } from '../../common/indexer-app.exceptions'
import { MongoCollections, SpkCollectionItem } from './mongo-access.model'

export class MongoRepository<T extends SpkCollectionItem> {
  private readonly _collection: Collection<T>

  constructor(private readonly db: Db, private readonly collectionName: MongoCollections) {
    this._collection = db.collection(collectionName)
  }

  public async getAllForCondition(filter: Filter<T>) {
    return await this._collection.find(filter).toArray()
  }

  public async insertOne(item: OptionalId<T>): Promise<InsertOneResult<T>> {
    return await this._collection.insertOne(item)
  }

  public async findById(id: string): Promise<T | null> {
    const items = await this._collection.find({ id: id } as any).toArray()
    if (items.length > 1) {
      throw new DataCorruptedException(
        `More than one instance in collection ${this.collectionName} found with ID ${id}!  IDs must be unique.`,
      )
    }

    // TODO - investigate type mismatch
    return (items[0] as any) || null
  }
}
