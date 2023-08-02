import { Collection } from "mongodb";
import { CoreService } from "./core.service";

interface Pin {
  value: string;
  metadata?: any;
  expiration: Date | null;
  added_at: Date 
  type: 'PROFILE' | 'PROFILE_POSTS' | 'OBJECT' | 'OBJECT_SUBGRAPH' | 'COMMUNITY'
}

export class PinManager {
  self: CoreService;
  pins: Collection<Pin>;
  constructor(self: CoreService) {
    this.self = self;
  }
  async addProfile(did: string) {
    await this.pins.insertOne({
      value: did,
      expiration: null,
      added_at: new Date(),
      type: "PROFILE"
    })
  }
  async ls({
    type
  }: {type: Pin['type']}) {
    
    return await this.pins.find({
      type
    }).toArray()
  }
  async start() {

    this.pins = this.self.db.collection('pins')

  }
}
