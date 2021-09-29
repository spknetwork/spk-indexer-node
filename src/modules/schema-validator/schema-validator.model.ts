import { ObjectId } from 'bson'
import { JSONSchema7 } from 'json-schema'
import { SpkCollectionItem } from '../mongo-access/mongo-access.model'

/**
 * NOTE about pulling doc authors
 * 
 * {
    controllers: ["did:3:2341"],  /*<-- We should be able to pull the parent_author from here. 
    Maybe make two types? 
    One for raw data coming from Ceramic and another for what gets put in the database (and often used elsewhere)?
 */
export class StoredSchema implements SpkCollectionItem {
  // Internal / mongo only ID
  _id: ObjectId //
  // Self StreamID
  id: string
  // Parent StreamID
  schema: JSONSchema7
}
