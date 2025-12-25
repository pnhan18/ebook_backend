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
          title: {
            type: 'text',
            analyzer: 'vietnamese',
            fields: { keyword: { type: 'keyword' } },
          },
          slug: { type: 'keyword' },
          description: { type: 'text', analyzer: 'vietnamese' },
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
              name: { type: 'text', analyzer: 'vietnamese' },
              slug: { type: 'keyword' },
            },
          },
          authors: {
            type: 'nested',
            properties: {
              id: { type: 'integer' },
              name: { type: 'text', analyzer: 'vietnamese' },
              slug: { type: 'keyword' },
            },
          },
        },
      },
    });
  }


  async indexBook(book: BookWithRelations) {
    return this.searchService.indexDocument(this.index, book.id.toString(), {
      id: book.id,
      title: book.title,
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
    return this.searchService.updateDocument(this.index, book.id.toString(), {
      title: book.title,
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
          must: [
            {
              bool: {
                should: [
                  {
                    multi_match: {
                      query,
                      fields: ['title^3'],
                      fuzziness: 'AUTO',
                      prefix_length: 1,
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
              },
            },
          ],
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
        slug: book.slug,
        description: book.description,
        coverImage: book.coverImage,
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
