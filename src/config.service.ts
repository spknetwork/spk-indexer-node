export interface IndexerAppConfig {
  mongoDatabaseName: string;
  mongoHost: string;
  ceramicHost: string;
}

export class ConfigService {
  static getConfig(): IndexerAppConfig {
    return {
      mongoDatabaseName: process.env.MONGO_DATABASE || 'spk-indexer-test',
      mongoHost: process.env.MONGO_HOST || 'localhost:27017',
      ceramicHost:
        process.env.CERAMIC_HOST || 'https://ceramic-clay.3boxlabs.com',
    };
  }
}
