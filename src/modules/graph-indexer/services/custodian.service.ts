import { StreamID } from '@ceramicnetwork/streamid'
import { IPFSHTTPClient, create as createIpfs } from 'ipfs-http-client'
import { Collection } from 'mongodb'
import NodeSchedule from 'node-schedule'
import Path from 'path'
import BloomFilters from 'bloom-filters'
import EventEmitter from 'events'
import Pushable from 'it-pushable'

import { decode, encode } from '../frame-codec.utils'
import { CSNode, IndexedDocument, IndexedNode } from '../graph-indexer.model'
import { SUBChannels, messageTypes } from '../../peer-to-peer/p2p.model'
import { CoreService } from './core.service'
import { TileDocument } from '@ceramicnetwork/stream-tile'
import { ConfigService } from '../../../config.service'
import { logger } from '../../../common/logger.singleton'
import GitCommitInfo from 'git-commit-info'
const {BloomFilter} = BloomFilters

const IPFS_PUBSUB_TOPIC = '/spk.network/testnet-dev'

const CUS_ANNOUNCE = 'cust_announce'

const ACCEPTED_ARBITRARY_FIELDS = ['parent_id', 'community_ref']
const ARBITRARY_SEARCH_ENABLED = true;

export class CustodianService {
  self: CoreService
  ipfs: IPFSHTTPClient
  myPeerId: string
  graphIndex: Collection<IndexedNode>
  graphDocs: Collection<IndexedDocument>
  graphCs: Collection<CSNode>
  asks: Set<string>
  events: EventEmitter
  custodianNodes: Collection
  constructor(self) {
    this.self = self

    this.handleSub = this.handleSub.bind(this)
    this.announceCustodian = this.announceCustodian.bind(this)
    this._receiveAnnounce = this._receiveAnnounce.bind(this)
    this.announceBloom = this.announceBloom.bind(this)
    this.checkPeers = this.checkPeers.bind(this)
    this.announceNode = this.announceNode.bind(this)

    this.asks = new Set()
    this.events = new EventEmitter()
  }
  /**
   * Receive custodian announcements from remote node.
   * @param payload
   * @param fromId
   */
  async _receiveAnnounce(payload, fromId) {
    if (this.myPeerId === fromId) {
      //console.log(payload, fromId)
      console.warn('peerId is the same as local node')
      return
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
  /**
   * Receive a bloom filter from a remote node.
   * If the bloom filter lacks entries of the current locally stored data, then the local node will send out missing entities from it's internal subgraph.
   * @todo: Prevent listening to bloom filter announcements if the node is not a custodian.
   * @todo: Garbage collection
   * @param payload
   * @param fromId
   */
  async _receiveBloomAnnounce(payload, fromId) {
    //console.log(payload, fromId)
    const parsedBloom = JSON.parse(payload.bloom)
    const bloomFilter = parsedBloom ? BloomFilter.fromJSON(parsedBloom) : null

    const arrayItems = await this.graphIndex
      .find({
        parent_id: payload.parent_id,
      })
      .toArray()
    let output = []
    //If no bloomFilter exists, proceed to assume all entries are unknown to the requester
    if (bloomFilter) {
      for (const item of arrayItems) {
        if (!bloomFilter.has(item.id)) {
          output.push(item.id)
        }
      }
    } else {
      output = arrayItems.map((e) => e.id)
    }
    const msg = {
      type: messageTypes.CUS_RES_SUBGRAPH,
      parent_id: payload.parent_id,
      content: {
        sg: output,
      },
    }
    void this.ipfs.pubsub.publish(
      Path.posix.join(IPFS_PUBSUB_TOPIC, SUBChannels.CUSTODIAN_SYNC),
      encode(msg),
    )
  }
  /**
   * Handles receiving subgraph from remote node, runs a filter, then converts the request into an internal event emission.
   * @param payload
   * @param fromId
   */
  async _receiveSubgraph(payload, fromId: string) {
    if (this.asks.has(payload.parent_id)) {
      void this.events.emit('remote.recv_subgraph', payload.content.sg, payload.parent_id)
    }
  }

  async _receiveNodeAnnounce(payload, fromId: string) {
    if (fromId === this.myPeerId) {
      return
    }
    await this.custodianNodes.findOneAndUpdate(
      {
        peer_id: fromId,
      },
      {
        $set: {
          name: payload.node_info.name,
          motd: payload.node_info.motd,
          version: payload.node_info.version,
          version_commit: payload.node_info.version_commit,
          operator: payload.node_info.operator,
          cryptoAccounts: payload.node_info.cryptoAccounts,
        },
      },
      {
        upsert: true,
      },
    )
  }
  async _receiveArbitraryBloom(payload:{
    bloom: any
    field: string
    exact_match: string
  }, fromId: string) {
    if (fromId === this.myPeerId) {
      return
    }
    if(!ACCEPTED_ARBITRARY_FIELDS.includes(payload.field)) {
      return;
    }
    const filter:BloomFilters.BloomFilter = BloomFilter.fromJSON(payload.bloom);
    const docs = await this.graphDocs.find({
      [`content.${payload.field}`]: payload.exact_match
    }).toArray()
    
    
    const newIds = []
    for(const doc of docs) {
      if(!filter.has(doc.id)) {
        newIds.push(doc.id)
      }
    }
  }
  /**
   * Announces custodianship of locally stored documents.
   * This function mainly does not important in the overall architecture. However, eventually routing will be necessary for maximum scalability.
   * @todo: Be custodian of only pinned documents and improve handling of when should a node become a custodian or not
   */
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
  /**
   * Announces local bloom filter to remote nodes
   * Other nodes will respond with the missing entries in your bloom filter
   * @param parent_id StreamId
   */
  async announceBloom(parent_id: string) {
    const bloomFilter = await this.self.createBloom(parent_id)
    const compiledBloom = bloomFilter ? bloomFilter.saveAsJSON() : bloomFilter
    const msg = {
      type: messageTypes.CUS_ASK_SUBGRAPH,
      parent_id: parent_id,
      bloom: JSON.stringify(compiledBloom),
    }
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
    if (msgObj.type === CUS_ANNOUNCE) {
      void this._receiveAnnounce(msgObj, message.from)
    } else if (msgObj.type === messageTypes.CUS_ASK_SUBGRAPH) {
      void this._receiveBloomAnnounce(msgObj, message.from)
    } else if (msgObj.type === messageTypes.CUS_RES_SUBGRAPH) {
      void this._receiveSubgraph(msgObj, message.from)
    } else if (msgObj.type === messageTypes.ANNOUNCE_NODE) {
      void this._receiveNodeAnnounce(msgObj, message.from)
    } else if(msgObj.type === messageTypes.ASK_ARBITRARY_BLOOM) {
      void this._receiveArbitraryBloom(msgObj, message.from)
    }
  }
  /**
   * This function transverses the first levle of the subgraph and stores each child entry
   * @param id StreamId
   */
  async transverseChildren(id: string) {
    const consumer = this.queryChildrenRemote(id)
    for await (const itemId of consumer) {
      const data = await TileDocument.load(this.self.ceramic, itemId as string)
      //Note: data.content is the first version of a document, data.next is the recent state.
      const { next, content } = data.state
      const parent_id = content.parent_id
      if (parent_id === id) {
        const currentDoc = await this.graphIndex.findOne({
          id: itemId,
          parent_id: id,
        })
        if (currentDoc) {
          await this.graphIndex.findOneAndUpdate(
            {
              _id: currentDoc._id,
            },
            {
              $set: {
                last_pinged: new Date(),
              },
            },
          )
        } else {
          await this.graphIndex.insertOne({
            id: itemId as string,
            parent_id: parent_id,
            expiration: null,
            first_seen: new Date(),
            last_pinged: new Date(),
          })
        }
      } else {
        //Do blacklisting/caching of validation result
      }
    }
  }
  /**
   * Queries remmote node for subgraph data
   * This function does not store any data in the mongodb database. Only a small amount of data for dedop and the ask list
   * Timeout is 120s
   * @param id StreamId
   */
  async *queryChildrenRemote(id: string) {
    const dedup = new Set()

    this.asks.add(id)

    await this.announceBloom(id)
    const source = Pushable()
    const func = (subgraphInfo, parent_id) => {
      if (parent_id === id) {
        for (const id of subgraphInfo) {
          source.push(id)
        }
      }
    }
    this.events.on('remote.recv_subgraph', func)
    setTimeout(() => {
      this.events.off('remote.recv_subgraph', func)
      source.end()
      this.asks.delete(id)
    }, 120 * 1000)

    for await (const id of source) {
      if (!dedup.has(id)) {
        dedup.add(id)
        yield id
      }
    }
  }
  async *remoteFind(field: string, value: any) {
    
    //First do a local find
    const ids = await this.graphDocs.distinct('id', {
      [field]: value
    })

    const filter = BloomFilter.from(ids, 0.001)
    const msg = {
      type: messageTypes.CUS_ASK_SUBGRAPH,
      bloom: filter.saveAsJSON(),
      field,
      exact_match: value
    }

    const codedMessage = encode(msg)
    await this.ipfs.pubsub.publish(
      Path.posix.join(IPFS_PUBSUB_TOPIC, SUBChannels.CUSTODIAN_ARBITRARY),
      codedMessage,
    )
    yield 'lol'
  }
  /**
   * Retrieves list of child entities in a subgraph from the local database only.
   * This does not query any remote nodes.
   * @param id StreamId
   * @returns {Array<string>}
   */
  async queryChildren(id: string) {
    return (
      await this.graphIndex
        .find({
          parent_id: id,
        })
        .toArray()
    ).map((e) => e.id)
  }
  async announceCreation(args: {
    headers: {
      namespace?: string
      creator_id?: string
      parent_id?: string | null
      type?: string
    }
    stream_id: string
  }) {
    const headers = {}
    if (args.headers.creator_id) {
      headers['creator_id'] = args.headers.creator_id
    }
    if (args.headers.parent_id) {
      headers['parent_id'] = args.headers.parent_id
    }
    if (args.headers.namespace) {
      headers['namespace'] = args.headers.namespace
    }
    const msg = {
      type: messageTypes.ANNOUNCE_POST,
      content: {
        headers: headers,
        stream_id: args.stream_id,
      },
    }
    
    logger.info(`Announcing post creation:`)
    const codedMessage = encode(msg)
    await this.ipfs.pubsub.publish(
      Path.posix.join(IPFS_PUBSUB_TOPIC, SUBChannels.CUSTODIAN_SYNC),
      codedMessage,
    )
  }
  async checkPeers() {
    const peers = await this.ipfs.pubsub.peers(
      Path.posix.join(IPFS_PUBSUB_TOPIC, SUBChannels.CUSTODIAN_SYNC),
    )
    const swarmPeers = await this.ipfs.swarm.peers({
      verbose: true
    })
    for(let peer of swarmPeers) {
      if(peers.includes(peer.peer)) {
       
        for await (let _ of this.ipfs.ping(peer.peer, {
          count: 1
        })) {

        }
        const cusNode = await this.custodianNodes.findOne(
          {
            peer_id: peer.peer,
          }
        )
        if(cusNode) {
          await this.custodianNodes.findOneAndUpdate(cusNode, {
            $set: {
              latency: Number(Number(peer.latency.split('ms')[0]).toFixed(2)),
              last_seen: new Date()
            }
          })
        }
      }
    }
  }
  /**
   * Announces that this node exists in the network
   */
  async announceNode() {
    const name = this.self.config.get('node.name')
    const cryptoAccounts = this.self.config.get('node.cryptoAccounts')

    try {
      void (await this.ipfs.pubsub.publish(
        Path.posix.join(IPFS_PUBSUB_TOPIC, SUBChannels.CUSTODIAN_SYNC),
        encode({
          type: messageTypes.ANNOUNCE_NODE,
          node_info: {
            name,
            cryptoAccounts,
            version: process.env.npm_package_version,
            version_commit: GitCommitInfo().hash
          },
        }),
      ))
    } catch {}
  }
  async start() {
    //Fire up collections
    this.graphIndex = this.self.db.collection('graph.index')
    this.graphCs = this.self.db.collection('graph.cs')
    this.graphDocs = this.self.db.collection('graph.docs')
    this.custodianNodes = this.self.db.collection('custodian_nodes')

    //Hook into IPFS node
    this.ipfs = createIpfs({ host: ConfigService.getConfig().ipfsHost })

    //Save our IPFS peer id
    this.myPeerId = (await this.ipfs.id()).id.toString()
    logger.info(`IPFS PeerId: ${this.myPeerId}`)

    //Fire up pubsub channels
    void this.ipfs.pubsub.subscribe(IPFS_PUBSUB_TOPIC, this.handleSub)
    void this.ipfs.pubsub.subscribe(
      Path.posix.join(IPFS_PUBSUB_TOPIC, SUBChannels.CUSTODIAN_SYNC),
      this.handleSub,
    )

    if (ARBITRARY_SEARCH_ENABLED) {
      void this.ipfs.pubsub.subscribe(
        Path.posix.join(IPFS_PUBSUB_TOPIC, SUBChannels.CUSTODIAN_ARBITRARY),
        this.handleSub,
      )
    }

    logger.info('Announcing node to world')
    await this.announceNode()

    //Register schedules
    NodeSchedule.scheduleJob('*/15 * * * *', this.announceNode)
    NodeSchedule.scheduleJob('* * * * *', this.announceCustodian)
    NodeSchedule.scheduleJob('* * * * *', this.checkPeers)
    NodeSchedule.scheduleJob('* * * * *', async () => {
      /*const consumer = this.queryChildrenRemote(
        'kjzl6cwe1jw14b57249n2ujjkiiucpdw9dic9rotvk2m1tlfbmoeo7ccwkz94ho',
      )
      for await (const item of consumer) {
        console.log(item)
      }*/
      /*void (await this.transverseChildren(
        'kjzl6cwe1jw14b57249n2ujjkiiucpdw9dic9rotvk2m1tlfbmoeo7ccwkz94ho',
      ))*/
      void this.announceBloom('kjzl6cwe1jw147nu8nkdx3stc4ztf8e3u6h5l5s54vbsyjfgmgt17flr895ugso')
    })
  }
  async stop() {
    void this.ipfs.pubsub.unsubscribe(IPFS_PUBSUB_TOPIC, this.handleSub)
  }
}
