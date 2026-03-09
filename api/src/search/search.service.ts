import { Injectable, OnModuleInit } from '@nestjs/common';
import { ElasticsearchService } from '@nestjs/elasticsearch';

@Injectable()
export class SearchService{
  constructor(private readonly elasticsearchService: ElasticsearchService) {}

  async createIndex(index: string, settings?: any) {
    const exists = await this.elasticsearchService.indices.exists({ index });
    if (!exists) {
      return this.elasticsearchService.indices.create({
        index,
        ...settings,
      });
    }
  }

  async indexDocument(index: string, id: string, document: any) {
    return this.elasticsearchService.index({
      index,
      id,
      document,
    });
  }

  async search(index: string, query: any) {
    return this.elasticsearchService.search({
      index,
      ...query,
    });
  }

  async deleteDocument(index: string, id: string) {
    return this.elasticsearchService.delete({
      index,
      id,
    });
  }

  async updateDocument(index: string, id: string, document: any) {
    return this.elasticsearchService.update({
      index,
      id,
      doc: document,
    });
  }

  async bulkIndex(index: string, documents: { id: string; document: any }[]) {
    const operations = documents.flatMap(({ id, document }) => [
      { index: { _index: index, _id: id } },
      document,
    ]);

    return this.elasticsearchService.bulk({ operations });
  }
}
