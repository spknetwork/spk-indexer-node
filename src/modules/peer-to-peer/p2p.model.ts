export const IPFS_PUBSUB_TOPIC = '/spk.network/testnet-dev'

export const messageTypes = {
  CUS_ANNOUNCE: 'cust_announce',
  CUS_ASK_SUBGRAPH: 'cust_ask_subgraph',
  CUS_RES_SUBGRAPH: 'cust_res_subgraph',
  ANNOUNCE_POST: 'announce_post',
  ANNOUNCE_NODE: 'announce_node',
  ASK_SUBGRAPH_BLOOM: 'ask_subgraph_bloom',
}

/**
 * The below defines a list of subchannels for various specific use cases or types of traffic.
 * For example on channel might be for custodian-custodian traffic, another might be for custodian-normal node traffic.
 *
 */
export const SUBChannels = {
  CUSTODIAN_DIRECT: 'custodian-direct',
  CUSTODIAN_SYNC: 'custodian-sync',
  CUSTODIAN_MULTICAST: 'custodian-multicast',
}
