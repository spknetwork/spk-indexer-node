import { Document, ObjectId } from 'bson'

export enum MongoCollections {
  IndexedDocs = 'graph.docs',
  GraphIndex = 'graph.index',
  StoredSchemas = 'graph.schemas',
}

export interface SpkCollectionItem extends Document {
  _id: ObjectId
  id: string
}
