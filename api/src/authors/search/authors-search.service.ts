import { Injectable, OnModuleInit } from '@nestjs/common';
import { SearchService } from '../../search/search.service';
import { StorageService } from '../../storage/storage.service';
import { Author } from '@prisma/client';

@Injectable()
export class AuthorsSearchService implements OnModuleInit {
  private readonly index = 'authors';

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
          analyzer: {
            vietnamese: {
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
            analyzer: 'vietnamese',
            fields: {
              keyword: { type: 'keyword' },
            },
          },
          slug: { type: 'keyword' },
          bio: { type: 'text', analyzer: 'vietnamese' },
          avatar: { type: 'keyword' },
          isActive: { type: 'boolean' },
          createdAt: { type: 'date' },
        },
      },
    });
  }

  async indexAuthor(author: Author) {
    return this.searchService.indexDocument(this.index, author.id.toString(), {
      id: author.id,
      name: author.name,
      slug: author.slug,
      bio: author.bio,
      avatar: author.avatar,
      isActive: author.isActive,
      createdAt: author.createdAt,
    });
  }

  async updateAuthor(author: Author) {
    return this.searchService.updateDocument(this.index, author.id.toString(), {
      name: author.name,
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
          must: [
            {
              multi_match: {
                query,
                fields: ['name^2'],
                fuzziness: 'AUTO',
                prefix_length: 1,
              },
            },
          ],
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
