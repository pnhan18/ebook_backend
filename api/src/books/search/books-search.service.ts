import { Injectable, OnModuleInit } from '@nestjs/common';
import { SearchService } from '../../search/search.service';
import { StorageService } from '../../storage/storage.service';
import { Book } from '@prisma/client';

interface BookWithRelations extends Book {
  categories?: { category: { id: number; name: string; slug: string } }[];
  authors?: { author: { id: number; name: string; slug: string } }[];
}

@Injectable()
export class BooksSearchService implements OnModuleInit {
  private readonly index = 'books';

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
            autocomplete_index: {
              type: 'custom',
              tokenizer: 'standard',
              filter: ['lowercase', 'asciifolding', 'autocomplete_filter'],
            },
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
          title: {
            type: 'text',
            analyzer: 'vietnamese_standard',
            fields: {
              keyword: { type: 'keyword' },
              autocomplete: {
                type: 'text',
                analyzer: 'autocomplete_index',
                search_analyzer: 'autocomplete_search',
              },
            },
          },
          titleFirst: {
            type: 'text',
            analyzer: 'autocomplete_index',
            search_analyzer: 'autocomplete_search',
          },
          slug: { type: 'keyword' },
          description: { type: 'text', analyzer: 'vietnamese_standard' },
          coverImage: { type: 'keyword' },
          price: { type: 'float' },
          status: { type: 'keyword' },
          accessType: { type: 'keyword' },
          isActive: { type: 'boolean' },
          viewCount: { type: 'integer' },
          createdAt: { type: 'date' },
          categories: {
            type: 'nested',
            properties: {
              id: { type: 'integer' },
              name: { type: 'text', analyzer: 'vietnamese_standard' },
              slug: { type: 'keyword' },
            },
          },
          authors: {
            type: 'nested',
            properties: {
              id: { type: 'integer' },
              name: { type: 'text', analyzer: 'vietnamese_standard' },
              slug: { type: 'keyword' },
            },
          },
        },
      },
    });
  }

  async indexBook(book: BookWithRelations) {
    const titleFirst = book.title.split(' ')[0];

    return this.searchService.indexDocument(this.index, book.id.toString(), {
      id: book.id,
      title: book.title,
      titleFirst,
      slug: book.slug,
      description: book.description,
      coverImage: book.coverImage,
      price: book.price ? Number(book.price) : null,
      status: book.status,
      accessType: book.accessType,
      isActive: book.isActive,
      viewCount: book.viewCount,
      createdAt: book.createdAt,
      categories: book.categories?.map((c) => c.category) || [],
      authors: book.authors?.map((a) => a.author) || [],
    });
  }

  async updateBook(book: BookWithRelations) {
    const titleFirst = book.title.split(' ')[0];

    return this.searchService.updateDocument(this.index, book.id.toString(), {
      title: book.title,
      titleFirst,
      slug: book.slug,
      description: book.description,
      coverImage: book.coverImage,
      price: book.price ? Number(book.price) : null,
      status: book.status,
      accessType: book.accessType,
      isActive: book.isActive,
      viewCount: book.viewCount,
      categories: book.categories?.map((c) => c.category) || [],
      authors: book.authors?.map((a) => a.author) || [],
    });
  }

  async deleteBook(id: number) {
    return this.searchService.deleteDocument(this.index, id.toString());
  }

  async search(query: string, options?: { page?: number; limit?: number }) {
    const page = options?.page || 1;
    const limit = options?.limit || 10;
    const from = (page - 1) * limit;

    const result = await this.searchService.search(this.index, {
      _source: ['id', 'title', 'slug', 'coverImage', 'price', 'accessType', 'authors'],
      query: {
        bool: {
          should: [
            {
              match: {
                titleFirst: {
                  query,
                  boost: 10,
                },
              },
            },
            {
              match: {
                'title.autocomplete': {
                  query,
                  boost: 3,
                },
              },
            },
            {
              match: {
                title: {
                  query,
                  fuzziness: 'AUTO',
                  boost: 2,
                },
              },
            },
            {
              nested: {
                path: 'authors',
                query: {
                  match: { 'authors.name': { query, fuzziness: 'AUTO' } },
                },
              },
            },
            {
              nested: {
                path: 'categories',
                query: {
                  match: { 'categories.name': { query, fuzziness: 'AUTO' } },
                },
              },
            },
          ],
          minimum_should_match: 1,
          filter: [
            { term: { isActive: true } },
            { term: { status: 'PUBLISHED' } },
          ],
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
          coverImage: source.coverImage
            ? await this.storageService.getPresignedDownloadUrl(source.coverImage)
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

  async bulkIndexBooks(books: BookWithRelations[]) {
    const documents = books.map((book) => ({
      id: book.id.toString(),
      document: {
        id: book.id,
        title: book.title,
        titleFirst: book.title.split(' ')[0],
        slug: book.slug,
        description: book.description,
        coverImage: book.coverImage,
        price: book.price ? Number(book.price) : null,
        status: book.status,
        accessType: book.accessType,
        isActive: book.isActive,
        viewCount: book.viewCount,
        createdAt: book.createdAt,
        categories: book.categories?.map((c) => c.category) || [],
        authors: book.authors?.map((a) => a.author) || [],
      },
    }));

    return this.searchService.bulkIndex(this.index, documents);
  }
}
