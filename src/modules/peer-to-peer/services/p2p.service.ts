import Channel from 'ipfs-pubsub-1on1';
import IPFS, {IPFSHTTPClient} from 'ipfs-http-client';
import * as IPFSDaemon from 'ipfs-core';
console.log(Channel);

void (async () => {
  const channel = await Channel.open(
    IPFS.create(),
    'QmcWwH48uvLq1tjYFHr153dCBTc1QSZ3jPFtqbZgTPTvi1'
  );
  // Explicitly wait for peers to connect

  // Process messages from the other peer
  channel.on('message', message => {
    console.log('Message from', message.from, message);
  });
  const channel2 = await Channel.open(
    await IPFSDaemon.create(),
    '12D3KooWLxp3mk99i9QYt1wNzGzv1zLS1ZppofTkw3bEgz9FwvS4'
  );
  console.log('ln 23');
  // Explicitly wait for peers to connect
  await channel2.connect();
  await channel.connect();
  // Send message on the channel
  await channel2.send('Hello World!');
  // Process messages from the other peer
  // Send message on the channel
  await channel.send('Hello World!');
  console.log('ln 23');
  channel2.on('message', message => {
    console.log('Message from', message.from, message);
  });
})();

export class P2PService {
  ipfs: IPFSHTTPClient;
  constructor() {}

  async listen() {}
  async start() {
    this.ipfs = IPFS.create();
  }
}
