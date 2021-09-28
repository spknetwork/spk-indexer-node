import { Document, ObjectId } from 'bson'
/**
 * NOTE about pulling doc authors
 * 
 * {
    controllers: ["did:3:2341"],  /*<-- We should be able to pull the parent_author from here. 
    Maybe make two types? 
    One for raw data coming from Ceramic and another for what gets put in the database (and often used elsewhere)?
 */
export class IndexedDocument implements Document {
  // Internal / mongo only ID
  _id: ObjectId //
  // Self StreamID
  streamId: string
  // Parent StreamID
  parentId?: string
  content: unknown
  expire?: any
  schemaStreamId?: string
  updated_at: Date
  last_checked: Date
}
