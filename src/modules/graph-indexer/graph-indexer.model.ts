import { ObjectId } from 'bson'
import { SpkCollectionItem } from '../mongo-access/spk-collection-item.type'
/**
 * NOTE about pulling doc authors
 * 
 * {
    controllers: ["did:3:2341"],  /*<-- We should be able to pull the parent_author from here. 
    Maybe make two types? 
    One for raw data coming from Ceramic and another for what gets put in the database (and often used elsewhere)?
 */

/**
 * Representation of ceramic documents in our local cache
 */
export class IndexedDocument implements SpkCollectionItem {
  // Internal / mongo only ID
  _id: ObjectId
  /**
   * Stream ID
   */
  id: string
  // Parent StreamID
  parentId?: string
  content: unknown
  expire?: any
  schemaStreamId?: string
  updated_at: Date
  last_checked: Date
}

/**
 * A node in the index
 */
export class IndexedNode implements SpkCollectionItem {
  _id: ObjectId
  // Stream ID
  id: string
  children: string[]
  expiration: any
  custodian_nodes: any[] // TODO - figure out the correct type for a custodian node
}
