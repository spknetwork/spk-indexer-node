import { ObjectId } from 'bson'
import { SpkCollectionItem } from '../mongo-access/mongo-access.model'
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
  parent_id?: string
  content: unknown
  expire?: any
  schema_stream_id?: string
  first_seen: Date
  created_at?: Date
  updated_at?: Date
  last_updated: Date // Note this is our internal calculated value, this may or may not actually be when it was updated in the Ceramic document. TODO: Use Ceramic timestamps
  last_pinged: Date //Last time the document was checked
  last_accessed?: Date //Maybe a bit too IO intensive?
  version_id?: string
  pinned: boolean
  creator_id?: string
}

/**
 * A node in the index
 */
export class IndexedNode implements SpkCollectionItem {
  _id: ObjectId
  // Stream ID
  id: string
  parent_id?: string
  expiration: any
  first_seen: Date
  last_pinged: Date //Last time the subgraph was received.
  last_pulled?: Date
  validated?: boolean
}
/**
 * A CS entry
 */
export class CSNode implements SpkCollectionItem {
  _id: ObjectId
  // Stream ID
  id: string
  custodian_id: string //Libp2p PeerId
  last_seen: Date //Latest date the node has announced it's responsibility of this subgraph
  first_seen: Date //Date the node has first announced it's responsibility of this subgraph
  last_ping: Date //Date the node has been known to be online
  ttl?: number //Period of time the record is valid for and must be rechecked. (ttl + last_seen) = recheck time
  ttl_time?: Date //Exact date of recheck

  /**
   * Metric used to determine how reputable a peer is;
   * Searching the database should sort based upon trust_score for optimal searching and/or last_seen.
   * For now the trust score is simple. X number of pings 30 minutes inbetween eachother will result in an increased trust_score.
   * Later versions of the software will use more advanced trust metrics to determine the most optimal nodes to use.
   * Initially: the goal here is to prevent a node from joining, then leaving 10 minutes later resulting in network confusion and/or spam in the database.
   */
  trust_score?: number
}

export interface CeramicContainer {
  headers?: any //Special headers regarding the application
  content: any
  parent_id?: string
  namespace?: string
  app?: string //App specific metadata
  family?: string // Schema validation?
  type: string //SPK.network format
}

export enum DocSortOption {
  createdasc = 'createdasc',
  createddesc = 'createddesc',
  updatedasc = 'updatedasc',
  updateddesc = 'updateddesc',
}

export interface CeramicDocContent {
  parent_id?: string
  created_at: string
  updated_at: string
  content: unknown
}
