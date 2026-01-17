import { Injectable, OnModuleInit } from '@nestjs/common';
import { SearchService } from '../../search/search.service';
import { StorageService } from '../../storage/storage.service';
import { Author } from '@prisma/client';

@Injectable()
export class AuthorsSearchService implements OnModuleInit {
  private readonly index = 'ebook-authors';

  constructor(
    private readonly searchService: SearchService,
    private readonly storageService: StorageService,
  ) {}

  async onModuleInit() {
    await this.createIndex();
  }

  async createIndex() {
    await this.searchService.createIndex(this.index, {
      settings: {
        analysis: {
          filter: {
            autocomplete_filter: {
              type: 'edge_ngram',
              min_gram: 1,
              max_gram: 20,
            },
          },
          analyzer: {
            vietnamese_standard: {
              type: 'custom',
              tokenizer: 'standard',
              filter: ['lowercase', 'asciifolding'],
            },
            // Index-time: tạo edge_ngram cho mỗi từ
            autocomplete_index: {
              type: 'custom',
              tokenizer: 'standard',
              filter: ['lowercase', 'asciifolding', 'autocomplete_filter'],
            },
            // Search-time: không dùng edge_ngram, chỉ normalize
            autocomplete_search: {
              type: 'custom',
              tokenizer: 'standard',
              filter: ['lowercase', 'asciifolding'],
            },
          },
        },
      },
      mappings: {
        properties: {
          id: { type: 'integer' },
          name: {
            type: 'text',
            analyzer: 'vietnamese_standard',
            fields: {
              keyword: { type: 'keyword' },
              // Autocomplete cho bất kỳ từ nào
              autocomplete: {
                type: 'text',
                analyzer: 'autocomplete_index',
                search_analyzer: 'autocomplete_search',
              },
            },
          },
          // Field riêng để ưu tiên match từ đầu
          nameFirst: {
            type: 'text',
            analyzer: 'autocomplete_index',
            search_analyzer: 'autocomplete_search',
          },
          slug: { type: 'keyword' },
          bio: { type: 'text', analyzer: 'vietnamese_standard' },
          avatar: { type: 'keyword' },
          isActive: { type: 'boolean' },
          createdAt: { type: 'date' },
        },
      },
    });
  }

  async indexAuthor(author: Author) {
    // Lấy từ đầu tiên của tên
    const nameFirst = author.name.split(' ')[0];

    return this.searchService.indexDocument(this.index, author.id.toString(), {
      id: author.id,
      name: author.name,
      nameFirst,
      slug: author.slug,
      bio: author.bio,
      avatar: author.avatar,
      isActive: author.isActive,
      createdAt: author.createdAt,
    });
  }

  async updateAuthor(author: Author) {
    const nameFirst = author.name.split(' ')[0];

    return this.searchService.updateDocument(this.index, author.id.toString(), {
      name: author.name,
      nameFirst,
      slug: author.slug,
      bio: author.bio,
      avatar: author.avatar,
      isActive: author.isActive,
    });
  }

  async deleteAuthor(id: number) {
    return this.searchService.deleteDocument(this.index, id.toString());
  }

  async search(query: string, options?: { page?: number; limit?: number }) {
    const page = options?.page || 1;
    const limit = options?.limit || 10;
    const from = (page - 1) * limit;

    const result = await this.searchService.search(this.index, {
      _source: ['id', 'name', 'slug', 'bio', 'avatar'],
      query: {
        bool: {
          should: [
            {
              match: {
                nameFirst: {
                  query,
                  boost: 10,
                },
              },
            },
            {
              match: {
                'name.autocomplete': {
                  query,
                  boost: 2,
                },
              },
            },
            {
              // Fallback fuzzy
              match: {
                name: {
                  query,
                  fuzziness: 'AUTO',
                },
              },
            },
          ],
          minimum_should_match: 1,
          filter: [{ term: { isActive: true } }],
        },
      },
      from,
      size: limit,
    });

    const data = await Promise.all(
      result.hits.hits.map(async (hit: any) => {
        const source = hit._source;
        return {
          ...source,
          avatar: source.avatar
            ? await this.storageService.getPresignedDownloadUrl(source.avatar)
            : null,
        };
      }),
    );

    return {
      data,
      total: (result.hits.total as any).value,
      page,
      limit,
    };
  }

  async bulkIndexAuthors(authors: Author[]) {
    const documents = authors.map((author) => ({
      id: author.id.toString(),
      document: {
        id: author.id,
        name: author.name,
        nameFirst: author.name.split(' ')[0],
        slug: author.slug,
        bio: author.bio,
        avatar: author.avatar,
        isActive: author.isActive,
        createdAt: author.createdAt,
      },
    }));

    return this.searchService.bulkIndex(this.index, documents);
  }
}
