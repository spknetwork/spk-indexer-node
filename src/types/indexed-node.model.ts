import { Document, ObjectId } from 'bson'

export class IndexedNode implements Document {
  _id: ObjectId
  streamId: string
  children: string[]
  expiration: any
  custodian_nodes: any[] // TODO - figure out the correct type for a custodian node
}
