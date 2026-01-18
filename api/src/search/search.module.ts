import { Module } from '@nestjs/common';
import { ElasticsearchModule } from '@nestjs/elasticsearch';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { SearchService } from './search.service';

@Module({
  imports: [
    ElasticsearchModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const node = config.get<string>('ELASTICSEARCH_URL');
        const username = config.get<string>('ELASTICSEARCH_USERNAME');
        const password = config.get<string>('ELASTICSEARCH_PASSWORD');

        if (!node || !username || !password) {
          throw new Error('Missing Elasticsearch environment variables');
        }

        return {
          node,
          auth: {
            username,
            password,
          },
          tls: {
            rejectUnauthorized: false,
          },
        };
      },
    }),
  ],
  providers: [SearchService],
  exports: [SearchService]
})
export class SearchModule { }
