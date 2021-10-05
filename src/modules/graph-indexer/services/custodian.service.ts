import { StreamID } from '@ceramicnetwork/streamid'
import IPFSHTTP, { IPFSHTTPClient } from 'ipfs-http-client'
import { Collection } from 'mongodb'
import NodeSchedule from 'node-schedule'
import Path from 'path'
import { BloomFilter } from 'bloom-filters'

import { decode, encode } from '../frame-codec.utils'
import { CSNode, IndexedNode } from '../graph-indexer.model'
import { SUBChannels, messageTypes } from '../../peer-to-peer/p2p.model'
import { CoreService } from './core.service'

const IPFS_PUBSUB_TOPIC = '/spk.network/testnet-dev'

const CUS_ANNOUNCE = 'cust_announce'

export class CustodianService {
  self: CoreService
  ipfs: IPFSHTTPClient
  myPeerId: string
  graphIndex: Collection<IndexedNode>
  graphCs: Collection<CSNode>
  asks: Set<string>
  constructor(self) {
    this.self = self

    this.handleSub = this.handleSub.bind(this)
    this.announceCustodian = this.announceCustodian.bind(this)
    this.receiveBloomAnnounce = this.receiveBloomAnnounce.bind(this)
    this.announceBloom = this.announceBloom.bind(this)

    this.asks = new Set()
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
  async receiveBloomAnnounce(payload, fromId) {
    console.log('receiving bloom announce')
    console.log(payload, fromId)
    const bloomFilter = BloomFilter.fromJSON(JSON.parse(payload.bloom))
    console.log(bloomFilter)
    const arrayItems = await this.graphIndex
      .find({
        parent_id: payload.parent_id,
      })
      .toArray()
    const output = []
    for (const item of arrayItems) {
      if (!bloomFilter.has(item.id)) {
        console.log('has')
        output.push(item.id)
      }
    }
    const msg = {
      type: messageTypes.CUS_RES_SUBGRAPH,
      content: {
        sg: output,
      },
    }
    console.log(msg)
    void this.ipfs.pubsub.publish(
      Path.posix.join(IPFS_PUBSUB_TOPIC, SUBChannels.CUSTODIAN_SYNC),
      encode(msg),
    )
  }
  async announceCustodian() {
    const out = (
      await this.self.graphDocs
        .find({
          parent_id: null,
          streamId: { $exists: true },
        })
        .toArray()
    ).map((e) => Buffer.from(StreamID.fromString(e.id).bytes).toString('base64'))
    const msg = {
      type: CUS_ANNOUNCE,
      content: {
        sg: out,
      },
    }
    const codedMessage = encode(msg)
    await this.ipfs.pubsub.publish(IPFS_PUBSUB_TOPIC, codedMessage)
  }
  async announceBloom() {
    console.log('announcing bloom')
    const parent_id = 'kjzl6cwe1jw14b57249n2ujjkiiucpdw9dic9rotvk2m1tlfbmoeo7ccwkz94ho'
    const bloomFilter = await this.self.createBloom(parent_id)
    const msg = {
      type: messageTypes.CUS_ASK_SUBGRAPH,
      parent_id,
      bloom: JSON.stringify(bloomFilter.saveAsJSON()),
    }
    console.log(Path.posix.join(IPFS_PUBSUB_TOPIC, SUBChannels.CUSTODIAN_SYNC))
    const codedMessage = encode(msg)
    await this.ipfs.pubsub.publish(
      Path.posix.join(IPFS_PUBSUB_TOPIC, SUBChannels.CUSTODIAN_SYNC),
      codedMessage,
    )
  }
  handleSub(message) {
    let msgObj
    try {
      msgObj = decode(message.data)
    } catch (ex) {
      return
    }
    console.log('receiving RDM' + msgObj.type)
    if (msgObj.type === CUS_ANNOUNCE) {
      void this.receiveAnnounce(msgObj, message.from)
    } else if (msgObj.type === messageTypes.CUS_ASK_SUBGRAPH) {
      void this.receiveBloomAnnounce(msgObj, message.from)
    }
  }
  async *queryChildren(id: string) {}
  async start() {
    this.graphIndex = this.self.db.collection('graph.index')
    this.graphCs = this.self.db.collection('graph.cs')
    this.ipfs = IPFSHTTP.create()

    this.myPeerId = (await this.ipfs.id()).id
    void this.ipfs.pubsub.subscribe(IPFS_PUBSUB_TOPIC, this.handleSub)
    void this.ipfs.pubsub.subscribe(
      Path.posix.join(IPFS_PUBSUB_TOPIC, SUBChannels.CUSTODIAN_SYNC),
      this.handleSub,
    )
    NodeSchedule.scheduleJob('* * * * *', this.announceCustodian)
    NodeSchedule.scheduleJob('* * * * *', this.announceBloom)
  }
  async stop() {
    console.log('system is stopping')
    void this.ipfs.pubsub.unsubscribe(IPFS_PUBSUB_TOPIC, this.handleSub)
  }
}
