import { StreamID } from '@ceramicnetwork/streamid'
import IPFSHTTP, { IPFSHTTPClient } from 'ipfs-http-client'
import { Collection } from 'mongodb'
import NodeSchedule from 'node-schedule'

import { decode, encode } from '../frame-codec.utils'
import { CSNode, IndexedNode } from '../graph-indexer.model'

export const IPFS_PUBSUB_TOPIC = '/spk.network/testnet-dev'

const CUS_ANNOUNCE = 'cust_announce'

export class CustodianService {
  ipfs: IPFSHTTPClient
  myPeerId: string
  graphIndex: Collection<IndexedNode>
  graphCs: Collection<CSNode>
  constructor(private readonly self) {
    this.self = self

    this.handleSub = this.handleSub.bind(this)
  }
  async receiveAnnounce(payload, fromId) {
    console.log(payload, fromId)
    if (this.myPeerId === fromId) {
      console.warn('peerId is the same as local node')
    }
    const announce_list = payload.content.sg.map((e) =>
      StreamID.fromBytes(Buffer.from(e, 'base64')),
    )
    for (const streamId of announce_list) {
      /*console.log(streamId.toString());
      const data = await this.graphIndex.findOne({
        id: streamId.toString(),
      });
      console.log(data);
      if (!data) {
        await this.graphIndex.insertOne({
          id: streamId.toString(),
          custodian_nodes: [fromId],
          expiration: new Date(new Date().getTime() / 1 + 1000000),
          children: [],
        });
      } else {
        if (!data.custodian_nodes.includes(fromId)) {
          await this.graphIndex.findOneAndUpdate(
            {
              id: streamId.toString(),
            },
            {
              $push: {
                custodian_nodes: fromId,
              },
            }
          );
        }
      }*/
      const csRecord = await this.graphCs.findOne({
        id: streamId.toString(),
        custodian_id: fromId,
      })
      if (!csRecord) {
        await this.graphCs.insertOne({
          id: streamId.toString(),
          custodian_id: fromId,
          first_seen: new Date(),
          last_seen: new Date(),
          last_ping: new Date(),
          ttl: 21600, //6 hours, hardcoding for now. In the future custodian nodes will announce a ttl between 300 seconds and 30 days.
        })
        //Note: Custodian records that expire will be removed from the database.
      } else {
        await this.graphCs.findOneAndUpdate(
          {
            _id: csRecord._id,
          },
          {
            $set: {
              last_seen: new Date(),
              last_ping: new Date(),
            },
          },
        )
      }
    }
  }
  announceCustodian = async () => {
    console.log('running custodian announce')
    const out = (
      await this.self.graphDocs
        .find({
          parent_id: null,
          streamId: { $exists: true },
        })
        .toArray()
    ).map((e) => Buffer.from(StreamID.fromString(e.streamId).bytes).toString('base64'))
    const msg = {
      type: CUS_ANNOUNCE,
      content: {
        sg: out,
      },
    }
    console.log(JSON.stringify(msg))
    const codedMessage = encode(msg)
    console.log(codedMessage)
    await this.ipfs.pubsub.publish(IPFS_PUBSUB_TOPIC, codedMessage)
  }
  handleSub = (message) => {
    console.log('ln 44 pass check')
    let msgObj
    try {
      msgObj = decode(message.data)
    } catch (ex) {
      console.log(ex)
      return
    }
    console.log(message)
    console.log('receiving announce 12')
    if (msgObj.type === CUS_ANNOUNCE) {
      console.log('receiving announce 52')
      void this.receiveAnnounce(msgObj, message.from)
    }
  }
  async start() {
    this.graphIndex = this.self.db.collection('graph.index')
    this.graphCs = this.self.db.collection('graph.cs')
    this.ipfs = IPFSHTTP.create()

    this.myPeerId = (await this.ipfs.id()).id
    void this.ipfs.pubsub.subscribe(IPFS_PUBSUB_TOPIC, this.handleSub)
    NodeSchedule.scheduleJob('* * * * *', this.announceCustodian)
  }
  async stop() {
    console.log('system is stopping')
    void this.ipfs.pubsub.unsubscribe(IPFS_PUBSUB_TOPIC, this.handleSub)
  }
}
