import { Collection } from "mongodb";
import NodeSchedule from "node-schedule";
import { CoreService } from "../core.service";

interface SocialConnectionLink {
  connection_type: String;
  target: String;
  created_at: Date;
  alias: String;
}

export class SocialConnections {
  self: CoreService;
  connections: Collection;
  constructor(self) {
    this.self = self;

    this.pullAll = this.pullAll.bind(this);
  }

  async addToIndex(did: string) {}

  async pullSingle(did: string) {
    const connections = await this.self.idx.get("socialConnectionIndex", did);

    if (!connections) {
      return;
    }

    const output = Object.values(connections);

    const followingNow = await this.connections.distinct("following", {
      follower: did,
    });

    const followingNew = {};
    for (let e of output) {
      followingNew[e.target] = true;
      try {
        await this.connections.insertOne({
          follower: did,
          following: e.target,
          followed_at: e.created_at,
          target_type: e.target_type, //@TODO rename "target_type" to something more representative
        });
      } catch {}
    }
    //Handle unfollowing
    for (let following of followingNow) {
      if (!followingNew[following]) {
        await this.connections.findOneAndDelete({
          follower: did,
          following: following,
        });
      }
    }
  }

  async pullAll() {
    const creators_to_check = await this.self.graphDocs.distinct("creator_id");
    console.log(creators_to_check);
    for (let did of creators_to_check) {
      await this.pullSingle(did);
    }
  }

  async start() {
    this.connections = this.self.db.collection("social_connections");
    NodeSchedule.scheduleJob("*/15 * * * *", this.pullAll);
    //NodeSchedule.scheduleJob('* * * * *', this.pullAll)
    
    try {
      await this.connections.createIndex({
        follower: 1,
        following: 1
      }, {
        unique: true
      })
    } catch {

    }
  }
}
